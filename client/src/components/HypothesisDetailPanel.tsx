import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  Zap, Ruler, Eye, Database, XCircle, ArrowRight,
  CheckCircle2, AlertCircle, Info, Cpu, Quote, MessageSquare
} from "lucide-react";
import { Hypothesis, EvidenceItem, type AnalysisSource } from "@/lib/mockData";
import { cn } from "@/lib/utils";

// ─── Evidence type config ─────────────────────────────────────────
const EVIDENCE_CONFIG: Record<EvidenceItem['type'], {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  rule: {
    icon: <Cpu className="w-3 h-3" />,
    label: 'Rule Engine',
    color: 'var(--rf-blue-fg)',
    bg: 'var(--rf-blue-bg)',
    border: 'var(--rf-blue-border)',
  },
  measurement: {
    icon: <Ruler className="w-3 h-3" />,
    label: '측정 데이터',
    color: 'var(--rf-green-fg)',
    bg: 'var(--rf-green-bg)',
    border: 'var(--rf-green-border)',
  },
  observation: {
    icon: <Eye className="w-3 h-3" />,
    label: '엔지니어 관찰',
    color: 'var(--rf-violet-fg)',
    bg: 'var(--rf-violet-bg)',
    border: 'var(--rf-violet-border)',
  },
  similar_case: {
    icon: <Database className="w-3 h-3" />,
    label: '유사 사례',
    color: 'var(--rf-amber-fg)',
    bg: 'var(--rf-amber-bg)',
    border: 'var(--rf-amber-border)',
  },
  rejected: {
    icon: <XCircle className="w-3 h-3" />,
    label: '배제 근거',
    color: 'var(--rf-red-fg)',
    bg: 'var(--rf-red-bg)',
    border: 'var(--rf-red-border)',
  },
};

const WEIGHT_CONFIG = {
  high: { label: '높음', color: '#10B981', dot: 'bg-emerald-400' },
  medium: { label: '중간', color: '#F59E0B', dot: 'bg-amber-400' },
  low: { label: '낮음', color: '#64748B', dot: 'bg-slate-400' },
};

function sourceLabel(source?: AnalysisSource): string {
  if (source === "llm") return "LLM";
  if (source === "local-rule") return "Local rule";
  if (source === "fallback") return "Fallback";
  if (source === "user-approved") return "User approved";
  return "Mock/state";
}

// ─── EvidenceCard ─────────────────────────────────────────────────
function EvidenceCard({ ev }: { ev: EvidenceItem }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = EVIDENCE_CONFIG[ev.type];
  const wt = WEIGHT_CONFIG[ev.weight];

  return (
    <motion.div
      layout
      className="rounded-lg overflow-hidden"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <button
        className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-accent transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ color: cfg.color }} className="flex-shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", wt.dot)} title={`중요도: ${wt.label}`} />
          </div>
          <p className="text-[11px] font-medium text-foreground/90 leading-snug">{ev.label}</p>
        </div>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform duration-150", expanded && "rotate-180")} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-border/40 pt-2">
              <p className="text-[11px] text-foreground/75 leading-relaxed">{ev.detail}</p>
              {ev.source && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  출처: {ev.source}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── HypothesisDetailCard ─────────────────────────────────────────
function HypothesisDetailCard({ hyp, onQuoteToChat }: { hyp: Hypothesis; onQuoteToChat?: (text: string, source: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'evidence' | 'mechanism' | 'actions'>('evidence');

  const confColor = hyp.confidence >= 70 ? '#10B981' : hyp.confidence >= 40 ? '#F59E0B' : '#F43F5E';
  const statusColor = hyp.status === 'validated' ? '#10B981' : hyp.status === 'rejected' ? '#F43F5E' : '#60A5FA';

  const supportingEvidence = hyp.evidence.filter(e => e.type !== 'rejected');
  const rejectedEvidence = hyp.evidence.filter(e => e.type === 'rejected');

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--rf-card-bg)', border: `1px solid ${hyp.status === 'validated' ? 'var(--rf-green-border)' : 'var(--rf-card-border)'}` }}
    >
      {/* Header */}
      <button
        className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-accent transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Confidence ring */}
        <div className="flex-shrink-0 mt-0.5">
          <svg width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="12" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="16" cy="16" r="12"
              fill="none"
              stroke={confColor}
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 12}`}
              strokeDashoffset={`${2 * Math.PI * 12 * (1 - hyp.confidence / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 16 16)"
              style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.23,1,0.32,1)' }}
            />
            <text x="16" y="19.5" textAnchor="middle" fontSize="8" fontWeight="700" fill={confColor} fontFamily="JetBrains Mono, monospace">
              {hyp.confidence}
            </text>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor }} />
            <span className="text-[10px] text-muted-foreground font-mono">
              {hyp.status === 'validated' ? '검증 완료' : hyp.status === 'rejected' ? '기각됨' : '분석 중'}
            </span>
          </div>
          <span className="mb-1 inline-flex rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
            {sourceLabel(hyp.source)}
          </span>
          <p className="text-xs font-semibold text-foreground/95 leading-snug">{hyp.title}</p>
        </div>

        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-1 transition-transform duration-150", expanded && "rotate-180")} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Confidence bar */}
            <div className="px-3 pb-2">
              <div className="conf-bar">
                <div className="conf-fill" style={{ width: `${hyp.confidence}%` }} />
              </div>
            </div>

            {/* Quick reasons */}
            <div className="px-3 pb-2 space-y-1">
              {hyp.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px]">
                  {r.type === 'up'
                    ? <TrendingUp className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                    : <TrendingDown className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                  }
                  <span style={{ color: r.type === 'up' ? 'var(--rf-green-fg)' : 'var(--rf-red-fg)' }}>{r.text}</span>
                </div>
              ))}
            </div>

            {/* Quote buttons */}
            {onQuoteToChat && (
              <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => onQuoteToChat(
                    `[${hyp.title}] Confidence: ${hyp.confidence}% | ${hyp.mechanism.slice(0, 100)}...`,
                    `가설: ${hyp.title}`
                  )}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all hover:scale-[0.97]"
                  style={{ background: 'var(--rf-blue-bg)', color: 'var(--rf-blue-fg)', border: '1px solid var(--rf-blue-border)' }}
                >
                  <Quote className="w-3 h-3" /> 가설 인용
                </button>
                {hyp.evidence.some(e => e.type === 'similar_case') && (
                  <button
                    onClick={() => {
                      const sc = hyp.evidence.find(e => e.type === 'similar_case');
                      if (sc && onQuoteToChat) onQuoteToChat(
                        `[유사 사례] ${sc.label}: ${sc.detail.slice(0, 120)}...`,
                        sc.source || '유사 사례 DB'
                      );
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all hover:scale-[0.97]"
                    style={{ background: 'var(--rf-amber-bg)', color: 'var(--rf-amber-fg)', border: '1px solid var(--rf-amber-border)' }}
                  >
                    <MessageSquare className="w-3 h-3" /> 유사 사례 인용
                  </button>
                )}
              </div>
            )}

            {/* Status change button */}
            {hyp.status !== 'validated' && (
              <div className="px-3 py-2 border-t border-border/40">
                <button
                  onClick={() => {
                    // Status change logic would go here
                    // For now, just show a toast
                    console.log('Hypothesis validated:', hyp.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[0.98] active:scale-[0.96]"
                  style={{ background: 'var(--rf-green-bg)', color: 'var(--rf-green-fg)', border: '1px solid var(--rf-green-border)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> 검증 완료로 변경
                </button>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex border-t border-border/40 border-b border-border/40">
              {([
                { key: 'evidence', label: `근거 (${hyp.evidence.length})` },
                { key: 'mechanism', label: '메커니즘' },
                { key: 'actions', label: `다음 조치 (${hyp.nextActions.length})` },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-medium transition-colors border-b-2",
                    activeTab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="p-3">
              <AnimatePresence mode="wait">
                {activeTab === 'evidence' && (
                  <motion.div key="ev" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    {supportingEvidence.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">지지 근거</p>
                        {supportingEvidence.map((ev, i) => <EvidenceCard key={i} ev={ev} />)}
                      </div>
                    )}
                    {rejectedEvidence.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">배제 근거</p>
                        {rejectedEvidence.map((ev, i) => <EvidenceCard key={i} ev={ev} />)}
                      </div>
                    )}
                    {hyp.evidence.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground/40 py-4">근거 없음</p>
                    )}
                  </motion.div>
                )}

                {activeTab === 'mechanism' && (
                  <motion.div key="mech" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="rounded-lg p-3 space-y-2"
                      style={{ background: 'var(--panel-surface-2)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--rf-amber-fg)' }}>물리적 메커니즘</p>
                      </div>
                      <p className="text-[11px] text-foreground/80 leading-relaxed">{hyp.mechanism}</p>
                    </div>
                    {hyp.rejectedReason && (
                      <div className="rounded-lg p-3 mt-2"
                        style={{ background: 'var(--rf-red-bg)', border: '1px solid var(--rf-red-border)' }}>
                        <p className="text-[10px] font-semibold text-rose-300/80 mb-1">기각 사유</p>
                        <p className="text-[11px] text-foreground/70 leading-relaxed">{hyp.rejectedReason}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'actions' && (
                  <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
                    {hyp.nextActions.length === 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400/70 py-2">
                        <CheckCircle2 className="w-4 h-4" />
                        분석 완료 — 추가 조치 없음
                      </div>
                    ) : (
                      hyp.nextActions.map((action, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg"
                          style={{ background: 'var(--rf-blue-bg)', border: '1px solid var(--rf-blue-border)' }}>
                          <ArrowRight className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-foreground/80 leading-snug">{action}</p>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main HypothesisDetailPanel ───────────────────────────────────
interface HypothesisDetailPanelProps {
  hypotheses: Hypothesis[];
  onQuoteToChat?: (text: string, source: string) => void;
}

export function HypothesisDetailPanel({ hypotheses, onQuoteToChat }: HypothesisDetailPanelProps) {
  return (
    <motion.div
      key="hyp"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">가설 목록</p>
        <span className="font-mono text-[10px] text-muted-foreground/60">{hypotheses.length}개</span>
      </div>

      {hypotheses.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground/40 text-xs">
          <Zap className="w-6 h-6 mx-auto mb-2 opacity-30" />
          아직 가설이 없습니다
        </div>
      ) : (
        <div className="space-y-3">
          {hypotheses.map(h => (
            <HypothesisDetailCard key={h.id} hyp={h} onQuoteToChat={onQuoteToChat} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
