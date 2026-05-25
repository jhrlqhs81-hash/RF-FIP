import type { ChatAttachment } from "./mockData";

export interface ParsedImportSource {
  title?: string;
  text: string;
  materials: ChatAttachment[];
}

interface ZipEntry {
  name: string;
  compression: number;
  compressed: Uint8Array;
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function makeImportId(prefix: string, sequence = 0): string {
  return `${prefix}-${Date.now()}-${sequence}-${Math.random().toString(36).slice(2, 8)}`;
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getAttribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`(?:^|\\s)${name}="([^"]*)"`);
  return pattern.exec(tag)?.[1];
}

function normalizePath(value: string): string {
  return value.replace(/^\/+/, "").replace(/\\/g, "/");
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseDelimitedTable(text: string, delimiter: string): string[][] {
  return text.trim().split(/\r?\n/).filter(Boolean).map(line => parseDelimitedLine(line, delimiter));
}

function makeFileMaterial(file: File): ChatAttachment {
  return {
    id: makeImportId("import-source"),
    type: file.type.startsWith("image/") ? "image" : "file",
    name: file.name,
    mimeType: file.type,
    size: file.size,
    url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
  };
}

function rowsToSources(file: File, rows: string[][], materialName = file.name): ParsedImportSource[] {
  const headers = rows[0] ?? [];
  const headerKeys = headers.map(normalizeHeader);
  const hasCaseColumns = headerKeys.some(key => ["caseid", "id", "issueid", "title", "casetitle", "symptom", "rootcause"].includes(key));
  if (rows.length >= 2 && hasCaseColumns) {
    const titleIndex = headerKeys.findIndex(key => ["title", "casetitle", "caseid", "id", "issueid"].includes(key));
    return rows.slice(1).map((row, index) => ({
      title: titleIndex >= 0 ? row[titleIndex] : `${materialName} row ${index + 1}`,
      text: headers.map((header, cellIndex) => `${header}: ${row[cellIndex] ?? ""}`).join("\n"),
      materials: [{
        id: makeImportId("import-row", index),
        type: "table",
        name: `${materialName} #${index + 1}`,
        mimeType: file.type,
        size: file.size,
        rows: [headers, row],
      }],
    }));
  }
  return [{
    title: materialName,
    text: rows.map(row => row.join("\t")).join("\n"),
    materials: [{
      id: makeImportId("import-table"),
      type: "table",
      name: materialName,
      mimeType: file.type,
      size: file.size,
      rows: rows.slice(0, 12),
    }],
  }];
}

function asRawText(item: unknown): string {
  if (item && typeof item === "object") {
    return Object.entries(item as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value ?? "")}`)
      .join("\n");
  }
  return String(item ?? "");
}

function splitTextSections(file: File, text: string, sourceMaterial: ChatAttachment): ParsedImportSource[] {
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const boundary = /^(---+|case\s*:|ISS-\d|KB-\d|\d+[.)]\s+)/i.test(line.trim());
    if (boundary && current.join("\n").trim()) {
      sections.push(current.join("\n").trim());
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.join("\n").trim()) sections.push(current.join("\n").trim());
  return (sections.length > 1 ? sections : [text]).map((section, index) => ({
    title: section.split(/\r?\n/).find(Boolean)?.slice(0, 90) ?? `${file.name} section ${index + 1}`,
    text: section,
    materials: [sourceMaterial],
  }));
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 66_000); offset -= 1) {
    if (readUInt32LE(bytes, offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid XLSX zip: end of central directory not found.");
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const decoder = new TextDecoder();
  const eocd = findEndOfCentralDirectory(bytes);
  const entryCount = readUInt16LE(bytes, eocd + 10);
  let cursor = readUInt32LE(bytes, eocd + 16);
  const entries: ZipEntry[] = [];

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (readUInt32LE(bytes, cursor) !== 0x02014b50) throw new Error("Invalid XLSX zip: central directory entry is corrupt.");
    const compression = readUInt16LE(bytes, cursor + 10);
    const compressedSize = readUInt32LE(bytes, cursor + 20);
    const nameLength = readUInt16LE(bytes, cursor + 28);
    const extraLength = readUInt16LE(bytes, cursor + 30);
    const commentLength = readUInt16LE(bytes, cursor + 32);
    const localHeaderOffset = readUInt32LE(bytes, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));

    const localNameLength = readUInt16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readUInt16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    entries.push({
      name: normalizePath(name),
      compression,
      compressed: bytes.slice(dataStart, dataStart + compressedSize),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateZipEntry(entry: ZipEntry): Promise<string> {
  if (entry.compression === 0) return new TextDecoder().decode(entry.compressed);
  if (entry.compression !== 8) throw new Error(`Unsupported XLSX zip compression method: ${entry.compression}`);
  const stream = new Blob([entry.compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const decompressed = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

async function loadZipTextMap(bytes: Uint8Array): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const entry of readZipEntries(bytes)) {
    if (entry.name.endsWith(".xml") || entry.name.endsWith(".rels")) {
      map.set(entry.name, await inflateZipEntry(entry));
    }
  }
  return map;
}

function parseSharedStrings(xml?: string): string[] {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si[\s\S]*?<\/si>/g)).map(match => {
    const textParts = Array.from(match[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map(part => decodeXml(part[1] ?? ""));
    return textParts.join("");
  });
}

function parseWorkbookSheets(workbookXml: string, relsXml?: string): Array<{ name: string; path: string }> {
  const rels = new Map<string, string>();
  if (relsXml) {
    for (const match of Array.from(relsXml.matchAll(/<Relationship\b[^>]*>/g))) {
      const tag = match[0];
      const id = getAttribute(tag, "Id");
      const target = getAttribute(tag, "Target");
      if (id && target) rels.set(id, normalizePath(target.startsWith("/") ? target : `xl/${target}`));
    }
  }
  return Array.from(workbookXml.matchAll(/<sheet\b[^>]*>/g)).map((match, index) => {
    const tag = match[0];
    const name = decodeXml(getAttribute(tag, "name") ?? `Sheet ${index + 1}`);
    const relationshipId = getAttribute(tag, "r:id");
    return {
      name,
      path: relationshipId && rels.has(relationshipId) ? rels.get(relationshipId)! : `xl/worksheets/sheet${index + 1}.xml`,
    };
  });
}

function columnIndexFromCellRef(cellRef?: string): number | undefined {
  const letters = /^[A-Z]+/i.exec(cellRef ?? "")?.[0];
  if (!letters) return undefined;
  return letters.toUpperCase().split("").reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function cellText(cellXml: string, sharedStrings: string[]): string {
  const type = getAttribute(cellXml.match(/<c\b[^>]*>/)?.[0] ?? "", "t");
  if (type === "inlineStr") {
    return Array.from(cellXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map(match => decodeXml(match[1] ?? "")).join("");
  }
  const value = /<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] ?? "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  return decodeXml(value);
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): string[][] {
  return Array.from(sheetXml.matchAll(/<row\b[\s\S]*?<\/row>/g)).map(rowMatch => {
    const cells: string[] = [];
    for (const cellMatch of Array.from(rowMatch[0].matchAll(/<c\b[\s\S]*?<\/c>/g))) {
      const cellXml = cellMatch[0];
      const cellTag = cellXml.match(/<c\b[^>]*>/)?.[0] ?? "";
      const columnIndex = columnIndexFromCellRef(getAttribute(cellTag, "r")) ?? cells.length;
      cells[columnIndex] = cellText(cellXml, sharedStrings).trim();
    }
    return cells.map(value => value ?? "");
  }).filter(row => row.some(Boolean));
}

async function readXlsxFile(file: File): Promise<ParsedImportSource[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const xmlFiles = await loadZipTextMap(bytes);
  const workbookXml = xmlFiles.get("xl/workbook.xml");
  if (!workbookXml) throw new Error("Invalid XLSX workbook: xl/workbook.xml not found.");
  const sharedStrings = parseSharedStrings(xmlFiles.get("xl/sharedStrings.xml"));
  const sheets = parseWorkbookSheets(workbookXml, xmlFiles.get("xl/_rels/workbook.xml.rels"));
  const sources = sheets.flatMap(sheet => {
    const sheetXml = xmlFiles.get(sheet.path);
    if (!sheetXml) return [];
    const rows = parseSheetRows(sheetXml, sharedStrings);
    if (!rows.length) return [];
    return rowsToSources(file, rows, `${file.name} / ${sheet.name}`);
  });
  return sources.length ? sources : [{
    title: file.name,
    text: `${file.name}\nNo readable worksheet rows found.`,
    materials: [makeFileMaterial(file)],
  }];
}

export async function readImportFile(file: File): Promise<ParsedImportSource[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".xlsx")) return readXlsxFile(file);
  if (lowerName.endsWith(".xls")) {
    return [{
      title: file.name,
      text: `${file.name}\nLegacy .xls binary workbook requires an additional parser dependency before cell extraction.`,
      materials: [makeFileMaterial(file)],
    }];
  }

  const sourceMaterial = makeFileMaterial(file);
  const textLike = file.type.startsWith("text/") || /\.(txt|csv|tsv|json|md)$/i.test(file.name);
  if (!textLike) {
    return [{
      title: file.name,
      text: `${file.name}\n${file.type || "unknown type"}\n${Math.round(file.size / 1024)} KB`,
      materials: [sourceMaterial],
    }];
  }

  const text = (await file.text()).trim();
  if (!text) return [{ title: file.name, text: `${file.name}\nEmpty file`, materials: [sourceMaterial] }];

  if (/\.(csv|tsv)$/i.test(file.name)) {
    const delimiter = lowerName.endsWith(".tsv") ? "\t" : ",";
    return rowsToSources(file, parseDelimitedTable(text, delimiter));
  }

  if (/\.json$/i.test(file.name)) {
    try {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.map((item, index) => ({
        title: item && typeof item === "object" ? String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).case_id ?? (item as Record<string, unknown>).id ?? `${file.name} item ${index + 1}`) : `${file.name} item ${index + 1}`,
        text: asRawText(item),
        materials: [sourceMaterial],
      }));
    } catch {
      return [{ title: file.name, text, materials: [sourceMaterial] }];
    }
  }

  if (/\.(txt|md)$/i.test(file.name)) return splitTextSections(file, text, sourceMaterial);

  return [{ title: file.name, text, materials: [sourceMaterial] }];
}
