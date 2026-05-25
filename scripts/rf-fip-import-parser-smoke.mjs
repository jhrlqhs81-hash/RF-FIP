import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const scratchDir = path.join(projectRoot, ".rf-fip-db", "import-parser-smoke");
const bundlePath = path.join(scratchDir, "import-parser-bundle.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function u16(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value >>> 0);
  return bytes;
}

function makeStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf-8");
    const data = Buffer.from(file.content, "utf-8");
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ]);
    localParts.push(localHeader, data);

    centralParts.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]));
    offset += localHeader.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  return Buffer.concat([
    ...localParts,
    centralDirectory,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0),
  ]);
}

function makeMinimalXlsx() {
  return makeStoredZip([
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="RCA" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships>
  <Relationship Id="rId1" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<worksheet>
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>case_id</t></is></c>
      <c r="B1" t="inlineStr"><is><t>title</t></is></c>
      <c r="C1" t="inlineStr"><is><t>band</t></is></c>
      <c r="D1" t="inlineStr"><is><t>symptom</t></is></c>
      <c r="E1" t="inlineStr"><is><t>root_cause</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>XLSX-001</t></is></c>
      <c r="B2" t="inlineStr"><is><t>B3 PIM desense</t></is></c>
      <c r="C2" t="inlineStr"><is><t>B3</t></is></c>
      <c r="D2" t="inlineStr"><is><t>RX sensitivity degradation 4dB during Tx 23dBm</t></is></c>
      <c r="E2" t="inlineStr"><is><t>Shield clip contact nonlinearity</t></is></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>XLSX-002</t></is></c>
      <c r="B3" t="inlineStr"><is><t>MIPI spur desense</t></is></c>
      <c r="C3" t="inlineStr"><is><t>B7</t></is></c>
      <c r="D3" t="inlineStr"><is><t>OTA fail only when display is on</t></is></c>
      <c r="E3" t="inlineStr"><is><t>Display FPC harmonic coupling</t></is></c>
    </row>
  </sheetData>
</worksheet>`,
    },
  ]);
}

await fs.mkdir(scratchDir, { recursive: true });
await build({
  entryPoints: [path.join(projectRoot, "client", "src", "lib", "importParser.ts")],
  outfile: bundlePath,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const { readImportFile } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`);

const csvBuffer = await fs.readFile(path.join(projectRoot, "test-fixtures", "import", "rf-desense-pim-sample.csv"));
const csvSources = await readImportFile(new File([csvBuffer], "rf-desense-pim-sample.csv", { type: "text/csv" }));
assert(csvSources.length === 3, `Expected 3 CSV sources, got ${csvSources.length}.`);
assert(csvSources[0].materials[0]?.type === "table", "CSV source did not preserve table material.");

const xlsxSources = await readImportFile(new File([makeMinimalXlsx()], "rf-desense-step2.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
assert(xlsxSources.length === 2, `Expected 2 XLSX row sources, got ${xlsxSources.length}.`);
assert(xlsxSources[0].text.includes("Shield clip contact nonlinearity"), "XLSX source text did not include row cell values.");
assert(xlsxSources[0].materials[0]?.type === "table", "XLSX source did not preserve table material.");
assert(xlsxSources[0].materials[0]?.rows?.[0]?.[0] === "case_id", "XLSX table material did not preserve headers.");

console.log(`RF-FIP import parser smoke passed: ${csvSources.length} CSV sources, ${xlsxSources.length} XLSX sources.`);
