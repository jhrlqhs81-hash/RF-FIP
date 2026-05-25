import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Edit3,
  FileText,
  Image as ImageIcon,
  Search,
  Sparkles,
  Table2,
  Tag,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Issue } from "@/lib/mockData";
import { classifyDesenseCase } from "@/lib/rfDesenseTaxonomy";
import { buildCaseDetailFromIssue } from "@/components/CaseDetailView";
import { toast } from "sonner";

function summaryText(item: string | { text: string }) {
  return typeof item === "string" ? item : item.text;
}

interface RcaSummaryModalProps {
  issue: Issue;
  onClose: () => void;
  onSubmit: () => void;
  onApprove?: () => void;
}

function EditableCard({
  title,
  icon,
  value,
  multiline = true,
  onChange,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    onChange(draft);
    setEditing(false);
  };

  return (
    <section className="rounded-xl border border-border/70 p-4" style={{ background: "var(--card)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground/90">
          {icon}
          {title}
        </p>
        {editing ? (
          <button onClick={save} className="flex items-center gap-1 text-[10px]" style={{ color: "var(--rf-green-fg)" }}>
            <Check className="h-3 w-3" /> 저장
          </button>
        ) : (
          <button onClick={() => { setDraft(value); setEditing(true); }} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            <Edit3 className="h-3 w-3" /> 편집
          </button>
        )}
      </div>
      {editing ? (
        multiline ? (
          <textarea
            className="min-h-24 w-full resize-none bg-transparent text-sm leading-relaxed text-foreground/90 outline-none"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => { if (event.key === "Escape") setEditing(false); }}
            autoFocus
          />
        ) : (
          <input
            className="w-full bg-transparent text-sm text-foreground/90 outline-none"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") save();
              if (event.key === "Escape") setEditing(false);
            }}
            autoFocus
          />
        )
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
          {value || <span className="text-muted-foreground/50">내용 없음</span>}
        </p>
      )}
    </section>
  );
}

export function RcaSummaryModal({ issue, onClose, onSubmit, onApprove }: RcaSummaryModalProps) {
  const topHyp = issue.hypotheses[0];
  const issueDetail = buildCaseDetailFromIssue(issue);
  const desenseInsight = classifyDesenseCase(
    issue.signatures,
    `${issue.title} ${topHyp?.title ?? ""} ${topHyp?.mechanism ?? ""} ${issue.chatSummary?.keyFindings.map(summaryText).join(" ") ?? ""}`,
  );

  const [fields, setFields] = useState<Record<string, string>>({
    symptom: issueDetail.symptom,
    symptomPattern: issueDetail.symptomPattern,
    desenseCategory: issueDetail.desenseCategory,
    rootCause: issueDetail.rootCause,
    causalChain: issueDetail.causalChain,
    diagnosticTests: issueDetail.diagnosticTests.join("\n"),
    suspectedStructures: issueDetail.suspectedStructures.join("\n"),
    mitigation: Array.isArray(issueDetail.mitigation) ? issueDetail.mitigation.join("\n") : issueDetail.mitigation,
    actionGuide: issueDetail.actionGuide,
    lessonsLearned: Array.isArray(issueDetail.lessonsLearned) ? issueDetail.lessonsLearned.join("\n") : issueDetail.lessonsLearned,
    decisionRationale: issueDetail.decisionRationale.join("\n"),
  });

  const updateField = (key: string) => (value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border"
        style={{ background: "var(--background)" }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border p-5" style={{ background: "var(--card)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border" style={{ background: "var(--rf-blue-bg)", borderColor: "var(--rf-blue-border)" }}>
              <FileText className="h-5 w-5" style={{ color: "var(--rf-blue-fg)" }} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">RCA Summary 자동 생성</h2>
              <p className="font-mono text-xs text-muted-foreground">{issue.id} · Knowledge DB 상세 양식 기준</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ background: "var(--rf-green-bg)", borderColor: "var(--rf-green-border)", color: "var(--rf-green-fg)" }}>
              <Sparkles className="mr-1 inline h-2.5 w-2.5" />AI 초안
            </span>
            <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-5xl space-y-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{issue.id}</span>
                <span className="sig-tag text-[10px]">{issue.model} · {issue.band}</span>
                <span className="sig-tag-new text-[10px]">편집 가능</span>
              </div>
              <h1 className="text-lg font-semibold text-foreground">{issue.title}</h1>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <EditableCard title="증상" icon={<FileText className="h-3.5 w-3.5 text-primary" />} value={fields.symptom} onChange={updateField("symptom")} />
              <EditableCard title="증상 패턴" icon={<Activity className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />} value={fields.symptomPattern} onChange={updateField("symptomPattern")} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <EditableCard title="원인 분류" icon={<Zap className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />} value={fields.desenseCategory} multiline={false} onChange={updateField("desenseCategory")} />
              <EditableCard title="Root Cause" icon={<Search className="h-3.5 w-3.5" style={{ color: "var(--rf-amber-fg)" }} />} value={fields.rootCause} onChange={updateField("rootCause")} />
              <EditableCard title="인과 체인" icon={<ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--rf-violet-fg)" }} />} value={fields.causalChain} onChange={updateField("causalChain")} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <EditableCard title="판별 시험" icon={<CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--rf-green-fg)" }} />} value={fields.diagnosticTests} onChange={updateField("diagnosticTests")} />
              <EditableCard title="의심 구조" icon={<Table2 className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />} value={fields.suspectedStructures} onChange={updateField("suspectedStructures")} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <EditableCard title="개선 조치" icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: "var(--rf-green-fg)" }} />} value={fields.mitigation} onChange={updateField("mitigation")} />
              <EditableCard title="조치 가이드" icon={<Zap className="h-3.5 w-3.5" style={{ color: "var(--rf-amber-fg)" }} />} value={fields.actionGuide} onChange={updateField("actionGuide")} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <EditableCard title="배운점" icon={<FileText className="h-3.5 w-3.5 text-primary" />} value={fields.lessonsLearned} onChange={updateField("lessonsLearned")} />
              <EditableCard title="의사결정 근거" icon={<CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--rf-green-fg)" }} />} value={fields.decisionRationale} onChange={updateField("decisionRationale")} />
            </div>

            <section className="rounded-xl border border-border/70 p-4" style={{ background: "var(--card)" }}>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground/90">
                <ImageIcon className="h-3.5 w-3.5" style={{ color: "var(--rf-blue-fg)" }} />
                사용 자료
              </p>
              {issueDetail.usedMaterials?.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {issueDetail.usedMaterials.map(material => (
                    <div key={material.id} className="rounded-lg border border-border/60 px-3 py-2 text-xs text-foreground/75">
                      {material.name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">연결된 이미지/표/URL이 없습니다.</p>
              )}
            </section>

            <section className="rounded-xl border border-border/70 p-4" style={{ background: "var(--card)" }}>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground/90">
                <Tag className="h-3.5 w-3.5 text-primary" />
                Signature
              </p>
              <div className="flex flex-wrap gap-1.5">
                {issue.signatures.map((sig, index) => (
                  <span key={`${sig.key}-${sig.value}-${index}`} className={sig.isNew ? "sig-tag-new" : "sig-tag"}>
                    {sig.key}: {sig.value}
                  </span>
                ))}
              </div>
            </section>

            {topHyp && (
              <section className="rounded-xl border border-border/70 p-4" style={{ background: "var(--card)" }}>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">최종 신뢰도</p>
                <div className="flex items-center gap-3">
                  <div className="conf-bar flex-1">
                    <div className="conf-fill" style={{ width: `${topHyp.confidence}%` }} />
                  </div>
                  <span className="font-mono text-sm font-bold" style={{ color: "var(--rf-green-fg)" }}>{topHyp.confidence}%</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desenseInsight.mechanism}</p>
              </section>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-between border-t border-border p-5" style={{ background: "var(--card)" }}>
          <p className="text-xs text-muted-foreground">
            {onApprove ? "편집 후 바로 DB 등록 가능합니다." : "편집 후 DB 등록 검토로 전달합니다."}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              취소
            </button>
            {onApprove ? (
              <button
                onClick={() => { onApprove(); onClose(); toast.success("RCA Summary가 DB에 등록되었습니다."); }}
                className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:scale-[0.98] active:scale-[0.96]"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)", boxShadow: "0 0 16px var(--ring)" }}
              >
                <CheckCircle2 className="h-4 w-4" /> DB 등록 승인
              </button>
            ) : (
              <button
                onClick={() => { onSubmit(); toast.success("RCA Summary가 DB 등록 검토로 전달되었습니다."); }}
                className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold transition-all hover:scale-[0.98] active:scale-[0.96]"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)", boxShadow: "0 0 16px var(--ring)" }}
              >
                <CheckCircle2 className="h-4 w-4" /> DB 등록 검토 전달
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
