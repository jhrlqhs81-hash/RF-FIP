import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Tag, Check, Pencil, Trash2, Sparkles, ChevronRight,
  SearchCode, ArrowRight, Zap, TrendingUp, CheckCircle2,
  AlertCircle, Clock, MessageSquare, X, SlidersHorizontal, RotateCcw, Save
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SignatureTag, IssueStatus } from "@/lib/mockData";
import { KnowledgeCase, findSimilarCases } from "@/lib/similarCasesDb";
import { RF_DESENSE_TAXONOMY, classifyDesenseCase } from "@/lib/rfDesenseTaxonomy";
import {
  DEFAULT_SIGNATURE_WEIGHT_RULES,
  mergeSignatureWeightRules,
  type SignatureWeightRule,
} from "@/lib/signatureWeights";
import { CaseDetailView, buildCaseDetailFromKnowledgeCase } from "@/components/CaseDetailView";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Signature taxonomy ───────────────────────────────────────────
const SIG_TAXONOMY = RF_DESENSE_TAXONOMY;

// ─── SimilarCaseCard ──────────────────────────────────────────────
function SimilarCaseCard({ kc, isTop, previewSigs, onQuoteToChat }: {
  kc: KnowledgeCase;
  isTop: boolean;
  previewSigs: SignatureTag[];
  onQuoteToChat?: (text: string, source: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const expanded = false;
  const sim = kc.similarity ?? 0;
  const insight = classifyDesenseCase(kc.signatures, `${kc.title} ${kc.confirmedRootCause}`);

  // 일치하는 키 하이라이트
  const matchedKeys = previewSigs
    .filter(s => kc.signatures.some(t => t.key.toLowerCase() === s.key.toLowerCase()))
    .map(s => s.key);

  const simColor =
    sim >= 70 ? '#10B981' :
    sim >= 45 ? '#F59E0B' :
    '#60A5FA';

  const statusIcon = kc.status === 'confirmed'
    ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
    : <Clock className="w-3 h-3 text-cyan-400" />;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "rounded-lg overflow-hidden border transition-all",
        isTop
          ? "border-emerald-500/30"
          : "border-border/60"
      )}
      style={{ background: isTop ? 'var(--rf-green-bg)' : 'var(--rf-card-bg)' }}
    >
      {/* Header */}
      <button
        className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-accent transition-colors"
        onClick={() => setModalOpen(true)}
      >
        {/* Similarity ring */}
        <div className="flex-shrink-0 mt-0.5">
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" fill="none" stroke="var(--border)" strokeWidth="2.5" />
            <circle
              cx="14" cy="14" r="11"
              fill="none"
              stroke={simColor}
              strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 11}`}
              strokeDashoffset={`${2 * Math.PI * 11 * (1 - sim / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 14 14)"
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.23,1,0.32,1)' }}
            />
            <text x="14" y="17" textAnchor="middle" fontSize="7" fontWeight="700" fill={simColor} fontFamily="JetBrains Mono, monospace">
              {sim}%
            </text>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {statusIcon}
            <span className="font-mono text-[10px] text-muted-foreground">{kc.id}</span>
            {isTop && (
              <span className="text-[9px] px-1 py-0.5 rounded font-bold"
                style={{ background: 'var(--rf-green-bg)', color: 'var(--rf-green-fg)', border: '1px solid var(--rf-green-border)' }}>
                최고 유사
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-foreground/90 leading-snug line-clamp-2">{kc.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{kc.model} · {kc.band}</p>
        </div>

        <ChevronRight className={cn(
          "w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1 transition-transform duration-150",
          expanded && "rotate-90"
        )} />
      </button>

      {/* Matched keys preview (always visible) */}
      {matchedKeys.length > 0 && (
        <div className="px-2.5 pb-2 flex flex-wrap gap-1">
          {matchedKeys.slice(0, 4).map(k => (
            <span key={k}
              className="text-[9px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: 'var(--rf-blue-bg)', color: 'var(--rf-blue-fg)', border: '1px solid var(--rf-blue-border)' }}
            >
              ✓ {k}
            </span>
          ))}
          {matchedKeys.length > 4 && (
            <span className="text-[9px] text-muted-foreground/60">+{matchedKeys.length - 4}개</span>
          )}
        </div>
      )}

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-3 space-y-2 border-t border-border/40 pt-2">
              {/* Root Cause */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Root Cause
                </p>
                <p className="text-[11px] text-foreground/80 leading-snug">{kc.confirmedRootCause}</p>
              </div>
              {/* Mitigation */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" /> Mitigation
                </p>
                <p className="text-[11px] text-foreground/80 leading-snug">{kc.mitigation}</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-md border border-border/50 p-2" style={{ background: 'var(--panel-surface-2)' }}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">원인 분류</p>
                  <p className="text-[11px] leading-snug" style={{ color: 'var(--rf-blue-fg)' }}>{insight.category}</p>
                </div>
                <div className="rounded-md border border-border/50 p-2" style={{ background: 'var(--panel-surface-2)' }}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">권장 판별 시험</p>
                  <ul className="space-y-0.5">
                    {insight.diagnosticTests.slice(0, 3).map((test, idx) => (
                      <li key={idx} className="text-[11px] text-foreground/75 leading-snug">• {test}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* All signatures */}
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Signature 비교</p>
                <div className="space-y-0.5">
                  {kc.signatures.map((t, i) => {
                    const curMatch = previewSigs.find(s => s.key.toLowerCase() === t.key.toLowerCase());
                    const isMatch = !!curMatch;
                    const isValueMatch = curMatch?.value.toLowerCase() === t.value.toLowerCase();
                    return (
                      <div key={i} className={cn(
                        "flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px]",
                        isMatch && isValueMatch
                          ? "bg-emerald-500/10"
                          : isMatch
                          ? "bg-amber-500/10"
                          : "opacity-40"
                      )}>
                        {isMatch && isValueMatch
                          ? <Check className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                          : isMatch
                          ? <AlertCircle className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
                          : <span className="w-2.5 h-2.5 flex-shrink-0" />
                        }
                        <span className="text-muted-foreground font-mono">{t.key}:</span>
                        <span
                          className={!isMatch ? 'text-foreground/50' : undefined}
                          style={isMatch ? { color: isValueMatch ? 'var(--rf-green-fg)' : 'var(--rf-amber-fg)' } : undefined}
                        >
                          {t.value}
                        </span>
                        {isMatch && !isValueMatch && curMatch && (
                          <span className="text-muted-foreground/50 ml-auto">현재: {curMatch.value}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quote button — 유사 사례 인용 */}
              {onQuoteToChat && (
                <button
                  onClick={() => onQuoteToChat(
                    `[유사 사례 ${kc.id}] ${kc.title}\n원인 분류: ${insight.category}\nRoot Cause: ${kc.confirmedRootCause}\n판별 시험: ${insight.diagnosticTests.slice(0, 2).join(' / ')}\nMitigation: ${kc.mitigation}`,
                    `유사 사례 DB (${kc.id})`
                  )}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium w-full justify-center transition-all hover:scale-[0.98] mt-1"
                  style={{ background: 'var(--rf-amber-bg)', color: 'var(--rf-amber-fg)', border: '1px solid var(--rf-amber-border)' }}
                >
                  <MessageSquare className="w-3 h-3" /> 이 사례 채팅에 인용
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border p-5"
              style={{ background: "var(--background)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">유사사례 상세</p>
                <button onClick={() => setModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CaseDetailView data={buildCaseDetailFromKnowledgeCase(kc)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── SimilarCasesPanel ────────────────────────────────────────────
export function SimilarCasesPanel({ signatures, previewSigs = [], signatureWeightRules, onQuoteToChat }: {
  signatures: SignatureTag[];
  previewSigs?: SignatureTag[];
  signatureWeightRules?: SignatureWeightRule[];
  onQuoteToChat?: (text: string, source: string) => void;
}) {
  const sigsToSearch = previewSigs.length > 0 ? previewSigs : signatures;
  const cases = useMemo(() => findSimilarCases(sigsToSearch, 15, 4, signatureWeightRules), [sigsToSearch, signatureWeightRules]);
  const isPreview = previewSigs.length > 0;

  if (sigsToSearch.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SearchCode className="w-3.5 h-3.5 text-blue-400" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          유사 사례
        </p>
        {isPreview && (
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium animate-pulse"
            style={{ background: 'var(--rf-blue-bg)', color: 'var(--rf-blue-fg)', border: '1px solid var(--rf-blue-border)' }}>
            실시간 미리보기
          </span>
        )}
        <span className="font-mono text-[10px] text-muted-foreground/60 ml-auto">
          {cases.length}건
        </span>
      </div>

      {cases.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground/40 text-xs rounded-lg border border-dashed border-border/40">
          <SearchCode className="w-5 h-5 mx-auto mb-1.5 opacity-30" />
          유사 사례 없음
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {cases.map((kc, i) => (
            <SimilarCaseCard
              key={kc.id}
              kc={kc}
              isTop={i === 0 && (kc.similarity ?? 0) >= 50}
              previewSigs={sigsToSearch}
              onQuoteToChat={onQuoteToChat}
            />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Main SignaturePanel ──────────────────────────────────────────
interface SignaturePanelProps {
  signatures: SignatureTag[];
  issueStatus: IssueStatus;
  onUpdate: (sigs: SignatureTag[]) => void;
  onQuoteToChat?: (text: string, source: string) => void;
}

function WeightInput({ value, onChange, title }: { value: number; onChange: (value: number) => void; title: string }) {
  return (
    <input
      aria-label={title}
      type="number"
      min={0}
      max={5}
      value={value}
      onChange={event => onChange(Math.max(0, Math.min(5, Number(event.target.value) || 0)))}
      className="h-7 w-11 rounded border border-border bg-input px-1 text-center text-[11px] font-mono text-foreground"
    />
  );
}

export function SignatureWeightSettings({
  rules,
  onUpdate,
  variant = "compact",
}: {
  rules: SignatureWeightRule[];
  onUpdate: (rules: SignatureWeightRule[]) => void;
  variant?: "compact" | "wide";
}) {
  const mergedRules = useMemo(() => mergeSignatureWeightRules(rules), [rules]);
  const [draft, setDraft] = useState<SignatureWeightRule[]>(mergedRules);

  useEffect(() => {
    setDraft(mergedRules);
  }, [mergedRules]);

  const updateRule = (id: string, patch: Partial<SignatureWeightRule>) => {
    setDraft(prev => prev.map(rule =>
      rule.id === id ? { ...rule, ...patch, updatedAt: new Date().toISOString() } : rule
    ));
  };

  const save = () => {
    onUpdate(draft);
    toast.success("Signature 가중치 설정을 저장했습니다.");
  };

  const resetDefaults = () => {
    setDraft(DEFAULT_SIGNATURE_WEIGHT_RULES);
    onUpdate(DEFAULT_SIGNATURE_WEIGHT_RULES);
    toast.success("Signature 가중치 기본값을 복원했습니다.");
  };

  return (
    <div className="rounded-lg p-3 text-xs space-y-3"
      style={{ background: 'var(--rf-card-bg)', border: '1px solid var(--rf-card-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            Signature 가중치 설정
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            0은 영향 없음, 3은 일반 단서, 5는 핵심 gate입니다. 분석은 원인분류/RCA,
            검색은 유사사례, 워크플로우는 누락 체크리스트와 LLM 맥락 우선순위에 반영됩니다.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={resetDefaults}
            className="flex h-7 items-center gap-1 rounded border border-border px-2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            기본값
          </button>
          <button
            type="button"
            onClick={save}
            className="flex h-7 items-center gap-1 rounded px-2 text-[10px] font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Save className="h-3 w-3" />
            저장
          </button>
        </div>
      </div>
      <div className={cn(variant === "wide" ? "max-h-[calc(100vh-260px)]" : "max-h-80", "space-y-2 overflow-y-auto pr-1")}>
        {draft.map(rule => (
          <div key={rule.id} className="rounded-md border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
            <div className="flex items-start justify-between gap-3">
              <label className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={event => updateRule(rule.id, { enabled: event.target.checked })}
                />
                <span className="truncate font-mono text-[11px] text-foreground" title={rule.signatureKey}>{rule.signatureKey}</span>
              </label>
              <div className="grid shrink-0 grid-cols-3 gap-2">
                <label className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-medium text-muted-foreground">분석</span>
                  <WeightInput title={`${rule.signatureKey} 분석 가중치`} value={rule.analysisWeight} onChange={value => updateRule(rule.id, { analysisWeight: value })} />
                </label>
                <label className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-medium text-muted-foreground">검색</span>
                  <WeightInput title={`${rule.signatureKey} 검색 가중치`} value={rule.retrievalWeight} onChange={value => updateRule(rule.id, { retrievalWeight: value })} />
                </label>
                <label className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-medium text-muted-foreground">워크플로우</span>
                  <WeightInput title={`${rule.signatureKey} 워크플로우 가중치`} value={rule.workflowWeight} onChange={value => updateRule(rule.id, { workflowWeight: value })} />
                </label>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{rule.reason}</p>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--rf-amber-fg)' }}>{rule.operationRule}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignaturePanel({ signatures, issueStatus, onUpdate, onQuoteToChat }: SignaturePanelProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editVal, setEditVal] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState('');
  const [addVal, setAddVal] = useState('');
  const [keySearch, setKeySearch] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // 실시간 미리보기용 — 편집/추가 중인 상태를 반영한 임시 Signature 배열
  const [previewSigs, setPreviewSigs] = useState<SignatureTag[]>([]);

  const addValRef = useRef<HTMLInputElement>(null);
  const editValRef = useRef<HTMLInputElement>(null);

  const isLocked = issueStatus === 'confirmed' || issueStatus === 'archived';

  // 편집 중 → 미리보기 Signature 업데이트
  useEffect(() => {
    if (editingIdx !== null && (editKey || editVal)) {
      const preview = signatures.map((s, i) =>
        i === editingIdx
          ? { ...s, key: editKey || s.key, value: editVal || s.value }
          : s
      );
      setPreviewSigs(preview);
    } else if (addKey || addVal) {
      const preview = [
        ...signatures,
        { key: addKey || '(새 키)', value: addVal || '(새 값)', isNew: true },
      ];
      setPreviewSigs(preview);
    } else {
      setPreviewSigs([]);
    }
  }, [editingIdx, editKey, editVal, addKey, addVal, signatures]);

  // ─── Edit handlers ──────────────────────────────────────────
  const startEdit = (i: number) => {
    setEditingIdx(i);
    setEditKey(signatures[i].key);
    setEditVal(signatures[i].value);
    setTimeout(() => editValRef.current?.focus(), 50);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    if (!editKey.trim() || !editVal.trim()) { cancelEdit(); return; }
    const next = signatures.map((s, i) =>
      i === editingIdx ? { ...s, key: editKey.trim(), value: editVal.trim(), isNew: false } : s
    );
    onUpdate(next);
    toast.success('Signature 수정 완료');
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditKey('');
    setEditVal('');
    setPreviewSigs([]);
  };

  // ─── Delete handler ─────────────────────────────────────────
  const deleteTag = (i: number) => {
    const removed = signatures[i];
    const next = signatures.filter((_, idx) => idx !== i);
    onUpdate(next);
    toast('Signature 삭제됨', {
      action: {
        label: '실행 취소',
        onClick: () => {
          onUpdate([...next.slice(0, i), removed, ...next.slice(i)]);
          toast.success('Signature 복원됨');
        },
      },
    });
  };

  // ─── Add handlers ───────────────────────────────────────────
  const commitAdd = () => {
    if (!addKey.trim() || !addVal.trim()) return;
    const exists = signatures.some(s => s.key.toLowerCase() === addKey.trim().toLowerCase());
    if (exists) { toast.error(`'${addKey}' 키는 이미 존재합니다.`); return; }
    onUpdate([...signatures, { key: addKey.trim(), value: addVal.trim(), isNew: true }]);
    toast.success(`Signature 추가: ${addKey}`);
    setAddKey(''); setAddVal(''); setKeySearch(''); setAddOpen(false);
    setPreviewSigs([]);
  };

  const selectPresetKey = (k: string) => {
    setAddKey(k);
    setKeySearch(k);
    setTimeout(() => addValRef.current?.focus(), 50);
  };

  // ─── Filtered taxonomy ──────────────────────────────────────
  const filteredTaxonomy = SIG_TAXONOMY.map(cat => ({
    ...cat,
    keys: cat.keys.filter(k =>
      k.toLowerCase().includes(keySearch.toLowerCase()) &&
      !signatures.some(s => s.key.toLowerCase() === k.toLowerCase())
    ),
  })).filter(cat => cat.keys.length > 0);

  const aiCount = signatures.filter(s => s.isNew).length;
  const manualCount = signatures.filter(s => !s.isNew).length;

  return (
    <motion.div
      key="sig"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-4"
    >
      {/* ── Signature list section ── */}
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Signature 태그</p>
            <span className="font-mono text-[10px] text-muted-foreground/60">{signatures.length}개</span>
          </div>
          <div className="flex items-center gap-1.5">
            {aiCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: 'var(--rf-green-bg)', color: 'var(--rf-green-fg)', border: '1px solid var(--rf-green-border)' }}>
                <Sparkles className="w-2.5 h-2.5" />
                AI {aiCount}
              </span>
            )}
            {!isLocked && (
              <Popover open={addOpen} onOpenChange={v => {
                setAddOpen(v);
                if (!v) { setAddKey(''); setAddVal(''); setKeySearch(''); setPreviewSigs([]); }
              }}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all hover:scale-[0.97] active:scale-[0.95]"
                    style={{ background: 'var(--rf-blue-bg)', color: 'var(--rf-blue-fg)', border: '1px solid var(--rf-blue-border)' }}
                  >
                    <Plus className="w-3 h-3" /> 추가
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="left" align="start" sideOffset={8}
                  className="w-72 p-0 overflow-hidden"
                  style={{ background: 'var(--popover)', border: '1px solid var(--border)', boxShadow: '0 8px 32px oklch(0 0 0 / 0.18)' }}
                >
                  {/* Add form */}
                  <div className="p-3 border-b border-border/60 space-y-2">
                    <p className="text-xs font-semibold text-foreground/90">Signature 추가</p>
                    <div className="relative">
                      <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                      <input
                        className="w-full text-xs text-foreground/90 pl-6 pr-2 py-1.5 rounded-md outline-none font-mono"
                        style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
                        placeholder="키 검색 또는 직접 입력..."
                        value={keySearch}
                        onChange={e => { setKeySearch(e.target.value); setAddKey(e.target.value); }}
                        onKeyDown={e => { if (e.key === 'Enter' && addKey) addValRef.current?.focus(); }}
                      />
                    </div>
                    <input
                      ref={addValRef}
                      className="w-full text-xs text-foreground/90 px-2 py-1.5 rounded-md outline-none"
                      style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
                      placeholder="값 입력..."
                      value={addVal}
                      onChange={e => setAddVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') setAddOpen(false); }}
                    />
                    <button
                      onClick={commitAdd}
                      disabled={!addKey.trim() || !addVal.trim()}
                      className="w-full py-1.5 rounded-md text-xs font-semibold transition-all disabled:opacity-30 hover:opacity-90"
                      style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                    >
                      추가
                    </button>
                  </div>
                  {/* Taxonomy browser */}
                  <div className="max-h-52 overflow-y-auto">
                    {filteredTaxonomy.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">
                        {keySearch ? '검색 결과 없음' : '모든 키가 사용 중입니다'}
                      </p>
                    ) : (
                      filteredTaxonomy.map(cat => (
                        <div key={cat.category}>
                          <button
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors uppercase tracking-wider"
                            onClick={() => setExpandedCat(expandedCat === cat.category ? null : cat.category)}
                          >
                            {cat.category}
                            <ChevronRight className={cn("w-3 h-3 transition-transform duration-150", (expandedCat === cat.category || !!keySearch) && "rotate-90")} />
                          </button>
                          <AnimatePresence>
                            {(expandedCat === cat.category || !!keySearch) && (
                              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                                {cat.keys.map(k => (
                                  <button key={k}
                                    className="w-full text-left px-5 py-1 text-xs text-foreground/70 hover:text-foreground hover:bg-accent transition-colors font-mono"
                                    onClick={() => selectPresetKey(k)}
                                  >
                                    {k}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/* Tag list */}
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {signatures.map((tag, i) => (
              <motion.div
                key={`${tag.key}-${i}`}
                layout
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                className="group rounded-lg overflow-hidden"
                style={{
                  background: 'var(--rf-card-bg)',
                  border: editingIdx === i
                    ? '1px solid oklch(0.45 0.18 260)'
                    : tag.isNew
                    ? '1px solid var(--rf-green-border)'
                    : '1px solid var(--rf-card-border)',
                }}
              >
                {editingIdx === i ? (
                  <div className="p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 text-right">키</span>
                      <input
                        className="flex-1 bg-transparent text-xs text-foreground/90 px-2 py-1 rounded outline-none font-mono"
                        style={{ background: 'var(--input)', border: '1px solid var(--rf-blue-border)' }}
                        value={editKey}
                        onChange={e => setEditKey(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') editValRef.current?.focus(); if (e.key === 'Escape') cancelEdit(); }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 text-right">값</span>
                      <input
                        ref={editValRef}
                        className="flex-1 bg-transparent text-xs text-foreground/90 px-2 py-1 rounded outline-none"
                        style={{ background: 'var(--input)', border: '1px solid var(--rf-blue-border)' }}
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                      <button onClick={cancelEdit} className="px-2 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground transition-colors">취소</button>
                      <button
                        onClick={commitEdit}
                        disabled={!editKey.trim() || !editVal.trim()}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium transition-all disabled:opacity-30 hover:opacity-90"
                        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                      >
                        <Check className="w-3 h-3" /> 저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    {tag.isNew
                      ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="AI 추출" />
                      : <span className="w-1.5 h-1.5 rounded-full bg-blue-400/50 flex-shrink-0" title="수동 입력" />
                    }
                    <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0 truncate" style={{ maxWidth: '44%' }} title={tag.key}>{tag.key}</span>
                    <span className="text-border/60 flex-shrink-0 text-[10px]">/</span>
                    <span className="text-[11px] text-foreground/90 font-medium flex-1 min-w-0 truncate" title={tag.value}>{tag.value}</span>
                    {!isLocked && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => startEdit(i)}
                          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors" title="편집">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteTag(i)}
                          className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-rose-400 hover:bg-rose-400/10 transition-colors" title="삭제">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {signatures.length === 0 && (
            <div className="text-center py-6 text-muted-foreground/40 text-xs">
              <Tag className="w-5 h-5 mx-auto mb-1.5 opacity-30" />
              Signature가 없습니다
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> AI 추출 ({aiCount})</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/50" /> 수동 ({manualCount})</span>
          {isLocked && <span className="text-amber-400/70 ml-auto">확정 — 편집 불가</span>}
        </div>

        {/* RAG weight */}
        <div className="rounded-lg p-3 text-xs space-y-1.5"
          style={{ background: 'var(--rf-card-bg)', border: '1px solid var(--rf-card-border)' }}>
          <p className="text-muted-foreground font-medium">RAG 검색 가중치</p>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">현재 상태</span>
            <span className="badge-hypothesis px-2 py-0.5 rounded text-[10px]">Hypothesis (0.2)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70">승인 후</span>
            <span className="badge-confirmed px-2 py-0.5 rounded text-[10px]">Confirmed (1.0)</span>
          </div>
        </div>

      </div>

    </motion.div>
  );
}
