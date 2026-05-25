import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Search,
  Table2,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { KnowledgeCase } from "@/lib/similarCasesDb";
import { ChatAttachment, Issue, SignatureTag, SummaryItem } from "@/lib/mockData";
import { classifyDesenseCase } from "@/lib/rfDesenseTaxonomy";

function textOf(item: SummaryItem): string {
  return typeof item === "string" ? item : item.text;
}

function DetailCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 p-4" style={{ background: "var(--card)" }}>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground/90">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

function MaterialDetailModal({ item, onClose }: { item: ChatAttachment; onClose: () => void }) {
  const externalUrl = item.type === "url" && item.url && /^https?:\/\//i.test(item.url) ? item.url : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border"
        style={{ background: "var(--card)" }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{item.name}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {item.type.toUpperCase()}{item.mimeType ? ` · ${item.mimeType}` : ""}{item.size ? ` · ${Math.round(item.size / 1024)} KB` : ""}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            닫기
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {item.type === "image" && item.url && (
            <img src={item.url} alt={item.name} className="mx-auto max-h-[64vh] rounded-xl border border-border/60 object-contain" />
          )}
          {item.type === "table" && item.rows?.length && (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="chat-table w-full">
                <thead>
                  <tr>{item.rows[0].map((cell, i) => <th key={i}>{cell}</th>)}</tr>
                </thead>
                <tbody>
                  {item.rows.slice(1).map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {item.type === "url" && (
            <div className="space-y-3 rounded-xl border border-border/60 p-4" style={{ background: "var(--panel-surface)" }}>
              <p className="text-sm text-foreground/85">{item.name}</p>
              {externalUrl ? (
                <a href={externalUrl} target="_blank" rel="noreferrer" className="chat-url inline-flex">
                  <ExternalLink className="h-3 w-3" />
                  외부 자료 열기
                </a>
              ) : (
                <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs leading-relaxed text-primary">
                  프로젝트 내부 참고 자료입니다. SPA 경로로 이동하지 않고 이 모달에서 문서 참조 정보만 표시합니다.
                  <span className="mt-1 block font-mono text-[11px] text-primary/80">{item.url ?? "RF_DESENSE_TAXONOMY.md"}</span>
                </div>
              )}
            </div>
          )}
          {item.type === "file" && (
            <div className="rounded-xl border border-border/60 p-4 text-sm text-foreground/80" style={{ background: "var(--panel-surface)" }}>
              파일 원문 분석은 현재 Gauss/API 스펙 확정 후 연결 예정입니다. 지금은 파일명, 형식, 크기 메타만 근거로 보관합니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MaterialPreview({ item, onOpen }: { item: ChatAttachment; onOpen: (item: ChatAttachment) => void }) {
  if (item.type === "image" && item.url) {
    return (
      <button onClick={() => onOpen(item)} className="overflow-hidden rounded-lg border border-border/60 text-left transition-colors hover:border-primary/40">
        <img src={item.url} alt={item.name} className="max-h-44 w-full object-cover" />
        <p className="px-2 py-1 text-[10px] text-muted-foreground">{item.name}</p>
      </button>
    );
  }
  if (item.type === "table" && item.rows?.length) {
    return (
      <button onClick={() => onOpen(item)} className="w-full overflow-x-auto rounded-lg border border-border/60 text-left transition-colors hover:border-primary/40">
        <table className="chat-table">
          <thead>
            <tr>{item.rows[0].map((cell, i) => <th key={i}>{cell}</th>)}</tr>
          </thead>
          <tbody>
            {item.rows.slice(1).map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </button>
    );
  }
  if (item.type === "url" && item.url) {
    return (
      <button onClick={() => onOpen(item)} className="chat-url inline-flex">
        <ExternalLink className="h-3 w-3" />
        {item.name}
      </button>
    );
  }
  return (
    <button onClick={() => onOpen(item)} className="rounded-lg border border-border/60 px-3 py-2 text-left text-xs text-foreground/75 transition-colors hover:border-primary/40">
      {item.name}
    </button>
  );
}

export function sampleMaterials(seed: string): ChatAttachment[] {
  return [
    {
      id: `${seed}-table`,
      type: "table",
      name: "측정 요약 표",
      rows: [
        ["항목", "결과", "판단"],
        ["Tx power sweep", "20 dBm 이상 악화", "Tx-induced 가능"],
        ["Pressure A/B", "압력 인가 시 변동", "접촉/PIM 가능"],
        ["IM 계산", "Rx 대역과 근접", "추가 확인 필요"],
      ],
    },
    {
      id: `${seed}-url`,
      type: "url",
      name: "RF Desense Taxonomy 참고",
      url: "RF_DESENSE_TAXONOMY.md",
    },
  ];
}

export function buildCaseDetailFromKnowledgeCase(kc: KnowledgeCase) {
  const insight = classifyDesenseCase(kc.signatures, `${kc.title} ${kc.confirmedRootCause}`);
  return {
    id: kc.id,
    title: kc.title,
    subtitle: `${kc.model} · ${kc.band}`,
    symptom: kc.title,
    symptomPattern: kc.symptomPattern ?? insight.symptomPattern,
    desenseCategory: insight.category,
    rootCause: kc.confirmedRootCause,
    causalChain: insight.mechanism,
    diagnosticTests: kc.diagnosticTests ?? insight.diagnosticTests,
    suspectedStructures: kc.suspectedStructures ?? insight.suspectedStructures,
    mitigation: kc.mitigation,
    actionGuide: insight.actionGuide,
    lessonsLearned: kc.lessonsLearned ?? insight.lessonsLearned,
    decisionRationale: kc.decisionRationale ?? insight.decisionRationale,
    usedMaterials: kc.usedMaterials ?? sampleMaterials(kc.id),
    signatures: kc.signatures,
  };
}

export function buildCaseDetailFromIssue(issue: Issue) {
  const topHyp = issue.hypotheses[0];
  const summaryText = issue.chatSummary
    ? [...issue.chatSummary.keyFindings, ...issue.chatSummary.confirmedFacts].map(textOf).join(" ")
    : "";
  const insight = classifyDesenseCase(issue.signatures, `${issue.title} ${topHyp?.title ?? ""} ${topHyp?.mechanism ?? ""} ${summaryText}`);
  return {
    id: issue.id,
    title: issue.title,
    subtitle: `${issue.model} · ${issue.band}`,
    symptom: issue.title,
    symptomPattern: insight.symptomPattern,
    desenseCategory: insight.category,
    rootCause: topHyp?.title ?? "Root Cause 미확정",
    causalChain: topHyp?.mechanism ?? insight.mechanism,
    diagnosticTests: insight.diagnosticTests,
    suspectedStructures: insight.suspectedStructures,
    mitigation: topHyp?.nextActions ?? [],
    actionGuide: insight.actionGuide,
    lessonsLearned: issue.chatSummary?.keyFindings.slice(0, 3).map(textOf) ?? [insight.lessonsLearned],
    decisionRationale: [
      ...(topHyp?.reasons.filter(reason => reason.type === "up").map(reason => reason.text) ?? []),
      ...insight.decisionRationale,
    ].slice(0, 6),
    usedMaterials: [
      ...issue.messages.flatMap(message => message.attachments ?? []),
      ...sampleMaterials(issue.id),
    ].slice(0, 4),
    signatures: issue.signatures,
  };
}

export interface CaseDetailData {
  id: string;
  title: string;
  subtitle?: string;
  symptom: string;
  symptomPattern: string;
  desenseCategory: string;
  rootCause: string;
  causalChain: string;
  diagnosticTests: string[];
  suspectedStructures: string[];
  mitigation: string | string[];
  actionGuide: string;
  lessonsLearned: string | string[];
  decisionRationale: string[];
  usedMaterials?: ChatAttachment[];
  signatures: SignatureTag[];
}

export function CaseDetailView({ data, editable = false }: { data: CaseDetailData; editable?: boolean }) {
  const mitigation = Array.isArray(data.mitigation) ? data.mitigation : [data.mitigation];
  const lessons = Array.isArray(data.lessonsLearned) ? data.lessonsLearned : [data.lessonsLearned];
  const materials = data.usedMaterials ?? [];
  const [selectedMaterial, setSelectedMaterial] = useState<ChatAttachment | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{data.id}</span>
          {data.subtitle && <span className="sig-tag text-[10px]">{data.subtitle}</span>}
          {editable && <span className="sig-tag-new text-[10px]">편집 가능</span>}
        </div>
        <h1 className="text-lg font-semibold text-foreground">{data.title}</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailCard title="증상" icon={<FileText className="h-3.5 w-3.5 text-primary" />}>
          <p className="text-sm leading-relaxed text-foreground/80">{data.symptom}</p>
        </DetailCard>
        <DetailCard title="증상 패턴" icon={<Activity className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />}>
          <p className="text-sm leading-relaxed text-foreground/80">{data.symptomPattern}</p>
        </DetailCard>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <DetailCard title="원인 분류" icon={<Zap className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />}>
          <p
            className="rounded-lg border px-3 py-2 text-sm font-medium"
            style={{
              background: "var(--rf-blue-bg)",
              borderColor: "var(--rf-blue-border)",
              color: "var(--rf-blue-fg)",
            }}
          >
            {data.desenseCategory}
          </p>
        </DetailCard>
        <DetailCard title="Root Cause" icon={<Search className="h-3.5 w-3.5" style={{ color: "var(--rf-amber-fg)" }} />}>
          <p className="text-sm leading-relaxed text-foreground/80">{data.rootCause}</p>
        </DetailCard>
        <DetailCard title="인과 체인" icon={<ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--rf-violet-fg)" }} />}>
          <p className="text-sm leading-relaxed text-foreground/80">{data.causalChain}</p>
        </DetailCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailCard title="판별 시험" icon={<CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--rf-green-fg)" }} />}>
          <ul className="space-y-1.5">
            {data.diagnosticTests.map((item, i) => <li key={i} className="text-xs leading-relaxed text-foreground/75">• {item}</li>)}
          </ul>
        </DetailCard>
        <DetailCard title="의심 구조" icon={<Table2 className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />}>
          <div className="flex flex-wrap gap-1.5">
            {data.suspectedStructures.map((item, i) => <span key={i} className="sig-tag">{item}</span>)}
          </div>
        </DetailCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailCard title="개선 조치" icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--rf-green-fg)" }} />}>
          <ul className="space-y-1.5">
            {mitigation.map((item, i) => <li key={i} className="text-xs leading-relaxed text-foreground/75">• {item}</li>)}
          </ul>
        </DetailCard>
        <DetailCard title="조치 가이드" icon={<Zap className="h-3.5 w-3.5" style={{ color: "var(--rf-amber-fg)" }} />}>
          <p className="text-sm leading-relaxed text-foreground/80">{data.actionGuide}</p>
        </DetailCard>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <DetailCard title="배운점" icon={<FileText className="h-3.5 w-3.5 text-primary" />}>
          <ul className="space-y-1.5">
            {lessons.map((item, i) => <li key={i} className="text-xs leading-relaxed text-foreground/75">• {item}</li>)}
          </ul>
        </DetailCard>
        <DetailCard title="의사결정 근거" icon={<CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--rf-green-fg)" }} />}>
          <ul className="space-y-1.5">
            {data.decisionRationale.map((item, i) => <li key={i} className="text-xs leading-relaxed text-foreground/75">• {item}</li>)}
          </ul>
        </DetailCard>
      </div>

      <DetailCard title="사용 자료" icon={<ImageIcon className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />}>
        {materials.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {materials.map(item => <MaterialPreview key={item.id} item={item} onOpen={setSelectedMaterial} />)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">연결된 이미지/표/URL이 없습니다.</p>
        )}
      </DetailCard>

      <DetailCard title="Signature" icon={<Tag className="h-3.5 w-3.5 text-primary" />}>
        <div className="flex flex-wrap gap-1.5">
          {data.signatures.map((sig, index) => (
            <span key={`${sig.key}-${sig.value}-${index}`} className={sig.isNew ? "sig-tag-new" : "sig-tag"}>
              {sig.key}: {sig.value}
            </span>
          ))}
        </div>
      </DetailCard>

      {selectedMaterial && (
        <MaterialDetailModal item={selectedMaterial} onClose={() => setSelectedMaterial(null)} />
      )}
    </div>
  );
}
