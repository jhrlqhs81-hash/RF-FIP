import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio, Bot, CheckCircle2, Zap, Send, Paperclip,
  TrendingUp, TrendingDown, Check, X, ChevronDown, Plus,
  Database, FileText, Sparkles, Tag, Info,
  Activity, Quote, ExternalLink, Image as ImageIcon, Table2, Search, Upload, ClipboardCheck, AlertTriangle, Loader2,
  Moon, Sun, Trash2, SlidersHorizontal, RefreshCw
} from "lucide-react";
import { MOCK_ISSUES, USERS, Issue, Message, SignatureTag, IssueStatus, ChatAttachment, type AnalysisSource, type SummaryItem, type User } from "@/lib/mockData";
import { KnowledgeCase, findSimilarCases } from "@/lib/similarCasesDb";
import { DEFAULT_KNOWLEDGE_CASES } from "@/lib/knowledgeSeedCases";
import { classifyDesenseCase } from "@/lib/rfDesenseTaxonomy";
import { extractRfSignatures, generateLocalRfReply, mergeSignatures } from "@/lib/localRfAnalyzer";
import { buildLocalHybridHypotheses } from "@/lib/hybridHypothesis";
import { buildLocalHybridSummary } from "@/lib/hybridSummary";
import {
  SIGNATURE_ALIAS_DICTIONARY,
  canAutoCanonicalizeAlias,
  canonicalizeSignatures,
  getRelatedAliasDictionary,
  mergeSignatureAliasDictionaries,
  normalizeAliasToken,
  type SignatureAliasEntry,
  type SignatureAliasCandidate,
  type SignatureAliasRelationType,
} from "@/lib/signatureAliasResolver";
import {
  mergeSignatureWeightRules,
  weightedSignatureContext,
  type SignatureWeightRule,
} from "@/lib/signatureWeights";
import {
  attachEvidenceTrace,
  buildImportCandidatesFromFiles,
  findDuplicateImportCase,
  makeImportId,
  normalizeCaseKey,
  type ImportCandidate,
} from "@/lib/importCandidateAnalyzer";
import { SignaturePanel, SignatureWeightSettings, SimilarCasesPanel } from "@/components/SignaturePanel";
import { getSignatureMappingStatus, isAnalysisMappingRisk, SignatureMappingBadge, SignatureMappingDetail, type SignatureMappingStatus } from "@/components/SignatureMapping";
import { getBandValue, splitSignatureTags } from "@/lib/signatureTagGroups";
import { HypothesisDetailPanel } from "@/components/HypothesisDetailPanel";
import { ChatSummaryPanel } from "@/components/ChatSummaryPanel";
import { RcaSummaryModal } from "@/components/RcaSummaryModal";
import { CaseDetailView, buildCaseDetailFromIssue, buildCaseDetailFromKnowledgeCase } from "@/components/CaseDetailView";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import {
  loadRfFipDb,
  loadRagOpsReport,
  type ImportApprovalRecord,
  type RagOpsReport,
  persistableAttachment,
  replaceIssues,
  RfFipApiError,
  runRfFipLlm,
  saveImportApproval,
  saveIssue,
  saveKnowledgeCase,
  saveSignatureAliases,
  saveSignatureDictionary,
  saveSignatureWeightRules,
} from "@/lib/rfFipApi";
import { hasRfAnalysisIntent } from "@shared/rfFipRuleCatalog";

// ─── Theme ────────────────────────────────────────────────────────


// ─── Status helpers ───────────────────────────────────────────────
const STATUS_CONFIG: Record<IssueStatus, { label: string; color: string; badgeClass: string }> = {
  new:        { label: '신규',        color: 'var(--muted-foreground)', badgeClass: 'badge-new' },
  hypothesis: { label: '가설 검토', color: 'var(--rf-amber-fg)', badgeClass: 'badge-hypothesis' },
  validated:  { label: '검증됨',  color: 'var(--rf-blue-fg)', badgeClass: 'badge-validated' },
  confirmed:  { label: '확정',  color: 'var(--rf-green-fg)', badgeClass: 'badge-confirmed' },
  archived:   { label: '보관',   color: 'var(--muted-foreground)', badgeClass: 'badge-archived' },
};
const STATUS_STEPS: IssueStatus[] = ['new', 'hypothesis', 'validated', 'confirmed', 'archived'];
const ISSUE_DELETE_STATUS_LABEL: Record<IssueStatus, string> = {
  new: '신규',
  hypothesis: '가설 검토',
  validated: '검증됨',
  confirmed: '확정',
  archived: '보관',
};
function canRemoveIssueFromList(issue: Issue): boolean {
  return Boolean(issue.id);
}

const CURRENT_USER_STORAGE_KEY = 'rf-fip-current-user';
const USER_DIRECTORY_STORAGE_KEY = 'rf-fip-user-directory';
const CUSTOM_USER_COLORS = ['#60A5FA', '#34D399', '#F59E0B', '#F472B6', '#A78BFA', '#2DD4BF'];

function makeUserId(name: string): string {
  const normalized = name.normalize('NFKC').trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '');
  return `user-${normalized || Date.now()}`;
}

function makeInitials(name: string): string {
  const compact = name.replace(/\s+/g, '').trim();
  if (!compact) return 'U';
  const asciiWords = name.trim().split(/\s+/).filter(Boolean);
  if (asciiWords.length > 1 && asciiWords.every(word => /^[A-Za-z]/.test(word))) {
    return asciiWords.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }
  return compact.slice(0, 2).toUpperCase();
}

function colorForUserId(id: string): string {
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CUSTOM_USER_COLORS[hash % CUSTOM_USER_COLORS.length];
}

function readStoredUsers(): Record<string, User> {
  if (typeof window === 'undefined') return USERS;
  try {
    const raw = window.localStorage.getItem(USER_DIRECTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return { ...USERS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return USERS;
  }
}

function readStoredCurrentUserId(users: Record<string, User>): string {
  if (typeof window === 'undefined') return 'kim';
  const stored = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  return stored && users[stored] ? stored : 'kim';
}

function persistUserSelection(users: Record<string, User>, currentUserId: string) {
  if (typeof window === 'undefined') return;
  const customUsers = Object.fromEntries(Object.entries(users).filter(([id]) => !USERS[id]));
  window.localStorage.setItem(USER_DIRECTORY_STORAGE_KEY, JSON.stringify(customUsers));
  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, currentUserId);
}

function toPersistableIssue(issue: Issue): Issue {
  return {
    ...issue,
    messages: issue.messages.map(message => ({
      ...message,
      attachments: message.attachments?.map(persistableAttachment),
    })),
  };
}

function normalizeLlmSignatures(value: unknown): SignatureTag[] {
  if (!Array.isArray(value)) return [];
  return canonicalizeSignatures(value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as { key?: unknown; value?: unknown; isNew?: unknown };
    if (typeof record.key !== 'string' || typeof record.value !== 'string') return [];
    return [{ key: record.key, value: record.value, isNew: record.isNew === true }];
  }));
}

function isRfAnalysisIntent(text: string, attachments: ChatAttachment[]): boolean {
  return hasRfAnalysisIntent(text, attachments.length);
}

function sourceLabel(source?: AnalysisSource): string {
  if (source === 'llm') return 'LLM';
  if (source === 'local-rule') return 'Local rule';
  if (source === 'fallback') return 'Fallback';
  if (source === 'user-approved') return 'User approved';
  return 'Mock/state';
}

function aliasRelationLabel(entry: SignatureAliasEntry) {
  const relation = entry.relationType ?? "alias";
  const labels: Record<string, string> = {
    synonym: "동의어",
    alias: "별칭",
    abbreviation: "약어",
    translation: "번역어",
    spelling_variant: "표기 변형",
    semantic_alias: "의미 동의어",
    related_to: "관련어",
    caused_by: "원인 관계",
    measured_by: "측정 관계",
    parent_of: "상위 관계",
    condition_of: "조건 관계",
    reject: "거부",
  };
  return labels[relation] ?? relation;
}

function aliasUsageLabel(entry: SignatureAliasEntry) {
  if ((entry.status ?? "approved") !== "approved") return "승인 대기";
  if ((entry.relationType ?? "alias") === "reject") return "거부됨";
  if (canAutoCanonicalizeAlias(entry)) return "자동 정규화";
  return "RAG 검색 확장";
}

function aliasUsageClass(entry: SignatureAliasEntry) {
  if ((entry.status ?? "approved") !== "approved") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if ((entry.relationType ?? "alias") === "reject") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (canAutoCanonicalizeAlias(entry)) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

type AliasCandidateAction = "canonicalize" | "related" | "reject";

function buildLlmChatAnalysis(result: Record<string, unknown>, fallback: { content: string; extractedTags: SignatureTag[] }) {
  return {
    content: typeof result.content === 'string' && result.content.trim() ? result.content : fallback.content,
    extractedTags: normalizeLlmSignatures(result.extractedTags).length > 0
      ? normalizeLlmSignatures(result.extractedTags)
      : fallback.extractedTags,
    source: 'llm' as AnalysisSource,
  };
}

function buildLlmFallbackNotice(error: unknown, localContent?: string): string {
  const suffix = localContent ? ["", localContent] : [];
  if (error instanceof RfFipApiError && error.status === 429) {
    return [
      "OpenAI API가 429(rate limit 또는 quota 제한)를 반환했습니다.",
      localContent ? "현재 답변은 임시 local 분석 결과입니다." : "일반 질문은 local RF 분석으로 대체하지 않았습니다.",
      ...suffix,
    ].join("\n");
  }
  if (error instanceof RfFipApiError) {
    return [
      `LLM API 호출이 실패했습니다. status=${error.status}`,
      localContent ? "현재 답변은 임시 local 분석 결과입니다." : "일반 질문은 local RF 분석으로 대체하지 않았습니다.",
      ...suffix,
    ].join("\n");
  }
  return localContent ?? "LLM API 호출이 실패했습니다. 일반 질문은 local RF 분석으로 대체하지 않았습니다.";
}

function summaryItemPlainText(item: SummaryItem): string {
  if (typeof item === 'string') return item;
  return [
    item.text,
    item.rationale ? `rationale=${item.rationale}` : '',
    item.evidence?.length ? `evidence=${item.evidence.join(' / ')}` : '',
    item.messageId ? `messageId=${item.messageId}` : '',
  ].filter(Boolean).join(' | ');
}

function buildSharedAnalysisContext(issue: Issue, signatureWeightRules: SignatureWeightRule[], knowledgeCases: KnowledgeCase[], signatureAliasDictionary: SignatureAliasEntry[]) {
  const signatureGroups = splitSignatureTags(issue.signatures);
  const similarCases = findSimilarCases(issue.signatures, 15, 4, signatureWeightRules, knowledgeCases, signatureAliasDictionary, {
    currentBand: getBandValue(issue.signatures, issue.band),
  });
  const weightedSignatures = weightedSignatureContext(signatureGroups.analysisSignatures, signatureWeightRules);
  return {
    issue: {
      id: issue.id,
      title: issue.title,
      model: issue.model,
      band: issue.band,
      status: issue.status,
    },
    signatures: signatureGroups.analysisSignatures.map(tag => ({
      key: tag.key,
      value: tag.value,
      source: tag.isNew ? 'extracted-or-new' : 'existing',
    })),
    metadataContext: signatureGroups.metadataTags.map(tag => ({
      key: tag.key,
      value: tag.value,
      source: tag.isNew ? 'extracted-or-new' : 'existing',
    })),
    narrativeContext: signatureGroups.narrativeTags.map(tag => ({
      key: tag.key,
      value: tag.value,
      source: tag.isNew ? 'extracted-or-new' : 'existing',
    })),
    weightedSignatureContext: weightedSignatures,
    topWeightedSignals: weightedSignatures.slice(0, 8),
    hypotheses: issue.hypotheses.map(hypothesis => ({
      id: hypothesis.id,
      title: hypothesis.title,
      confidence: hypothesis.confidence,
      status: hypothesis.status,
      source: hypothesis.source,
      mechanism: hypothesis.mechanism,
      reasons: hypothesis.reasons,
      evidence: hypothesis.evidence.map(item => ({
        type: item.type,
        label: item.label,
        detail: item.detail,
        source: item.source,
        weight: item.weight,
      })),
      nextActions: hypothesis.nextActions,
    })),
    summary: issue.chatSummary ? {
      source: issue.chatSummary.source,
      lastUpdated: issue.chatSummary.lastUpdated,
      keyFindings: issue.chatSummary.keyFindings.map(summaryItemPlainText),
      confirmedFacts: issue.chatSummary.confirmedFacts.map(summaryItemPlainText),
      pendingQuestions: issue.chatSummary.pendingQuestions.map(summaryItemPlainText),
      nextSteps: issue.chatSummary.nextSteps.map(summaryItemPlainText),
    } : undefined,
    similarCases: similarCases.map(item => ({
      id: item.id,
      title: item.title,
      similarity: item.similarity,
      bandMatch: item.bandMatch,
      bandComparison: item.bandComparison,
      rootCause: item.confirmedRootCause,
      mitigation: item.mitigation,
      signatures: item.signatures,
    })),
    recentMessages: issue.messages.slice(-8).map(message => ({
      id: message.id,
      type: message.type,
      source: message.source,
      provider: message.provider,
      content: message.content.slice(0, 800),
      extractedTags: message.extractedTags,
      pendingAliasCandidates: message.pendingAliasCandidates,
      attachments: message.attachments?.map(attachment => ({
        type: attachment.type,
        name: attachment.name,
        evidence: attachment.evidence,
        rows: attachment.rows?.slice(0, 4),
      })),
    })),
  };
}

type IssueEvent =
  | { id: string; kind: 'message'; title: string; detail: string; time: string; messageId: string; source?: AnalysisSource; provider?: Message['provider']; fallbackReason?: string }
  | { id: string; kind: 'panel'; title: string; detail: string; time: string; panel: 'hypotheses' | 'signatures' | 'similar' | 'summary'; source?: AnalysisSource };

function buildIssueEvents(issue: Issue): IssueEvent[] {
  const events: IssueEvent[] = [
    {
      id: `${issue.id}-created`,
      kind: 'message',
      title: '이슈 생성',
      detail: `${issue.title} · ${issue.model} · ${issue.band}`,
      time: issue.createdAt,
      messageId: issue.messages[0]?.id ?? '',
      source: 'user-approved',
    },
  ];

  for (const msg of issue.messages) {
    events.push({
      id: msg.id,
      kind: 'message',
      title: msg.type === 'ai' ? 'AI 답변' : msg.type === 'user' ? '사용자 입력' : '시스템 메시지',
      detail: msg.content,
      time: msg.timestamp,
      messageId: msg.id,
      source: msg.source,
      provider: msg.provider,
      fallbackReason: msg.fallbackReason,
    });
    if (msg.extractedTags?.length) {
      events.push({
        id: `${msg.id}-sig`,
        kind: 'panel',
        title: 'Signature 추출',
        detail: msg.extractedTags.map(tag => `${tag.key}=${tag.value}`).join(', '),
        time: msg.timestamp,
        panel: 'signatures',
        source: msg.source ?? 'local-rule',
      });
    }
  }

  for (const hyp of issue.hypotheses) {
    events.push({
      id: `${hyp.id}-hyp`,
      kind: 'panel',
      title: `가설 ${hyp.status === 'validated' ? '검증 완료' : hyp.status === 'rejected' ? '기각' : '생성'}`,
      detail: `${hyp.title} · confidence ${hyp.confidence}%`,
      time: issue.chatSummary?.lastUpdated ?? issue.createdAt,
      panel: 'hypotheses',
      source: hyp.source ?? 'mock',
    });
  }

  if (issue.chatSummary) {
    events.push({
      id: `${issue.id}-summary`,
      kind: 'panel',
      title: '요약 갱신',
      detail: `다음 단계 ${issue.chatSummary.nextSteps.length}개 · 미해결 질문 ${issue.chatSummary.pendingQuestions.length}개`,
      time: issue.chatSummary.lastUpdated,
      panel: 'summary',
      source: issue.chatSummary.source ?? 'mock',
    });
  }

  return events.slice(-12).reverse();
}

function StatusBadge({ status }: { status: IssueStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.badgeClass)}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function StatusTimeline({ status }: { status: IssueStatus }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 w-full">
      {STATUS_STEPS.filter(s => s !== 'archived').map((step, i) => {
        const cfg = STATUS_CONFIG[step];
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            <div className={cn(
              "flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold transition-all duration-300",
              isDone ? "border" :
              isActive ? "border-2" : "bg-muted/30 text-muted-foreground border border-border"
            )} style={isDone ? { background: 'var(--rf-green-bg)', borderColor: 'var(--rf-green-border)', color: 'var(--rf-green-fg)' } : isActive ? { borderColor: cfg.color, color: cfg.color } : {}}>
              {isDone ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            {i < STATUS_STEPS.length - 2 && (
              <div className="flex-1 h-px transition-all duration-500" style={{ background: isDone ? 'var(--rf-green-border)' : 'var(--border)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function UserAvatar({ user, size = 'sm' }: { user?: User | null; size?: 'sm' | 'md' }) {
  if (!user) return null;
  const sz = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold flex-shrink-0", sz)}
      style={{ background: user.color + '22', color: user.color, border: `1px solid ${user.color}44` }}>
      {user.initials}
    </div>
  );
}

// ─── Media rendering helpers ──────────────────────────────────────
function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const Icon = isLight ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function MediaBlock({ type, src, alt, rows }: {
  type: 'image' | 'table' | 'url';
  src?: string;
  alt?: string;
  rows?: string[][];
}) {
  if (type === 'image' && src) {
    return (
      <div className="mt-2">
        <img src={src} alt={alt || ''} className="chat-image max-h-40 object-cover" />
        {alt && <p className="text-[10px] text-muted-foreground mt-1">{alt}</p>}
      </div>
    );
  }
  if (type === 'table' && rows && rows.length > 0) {
    return (
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="chat-table">
          <thead>
            <tr>{rows[0].map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, i) => (
              <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === 'url' && src) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className="chat-url mt-1.5 inline-flex">
        <ExternalLink className="w-3 h-3" />
        {alt || src}
      </a>
    );
  }
  return null;
}

function AttachmentBlock({ attachment }: { attachment: ChatAttachment }) {
  const evidence = attachment.evidence ?? [];
  if (attachment.type === 'image') {
    return (
      <div>
        <MediaBlock type="image" src={attachment.url} alt={attachment.name} />
        {evidence.length > 0 && <AttachmentEvidenceList evidence={evidence} />}
      </div>
    );
  }
  if (attachment.type === 'table') {
    return (
      <div>
        <MediaBlock type="table" rows={attachment.rows} />
        {evidence.length > 0 && <AttachmentEvidenceList evidence={evidence} />}
      </div>
    );
  }
  if (attachment.type === 'url') {
    return (
      <div>
        <MediaBlock type="url" src={attachment.url} alt={attachment.name} />
        {evidence.length > 0 && <AttachmentEvidenceList evidence={evidence} />}
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-border/60 px-3 py-2 text-xs text-foreground/75">
      <Paperclip className="mr-1 inline h-3 w-3" />
      {attachment.name}
      {evidence.length > 0 && <AttachmentEvidenceList evidence={evidence} />}
    </div>
  );
}

function AttachmentEvidenceList({ evidence }: { evidence: string[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {evidence.map((item, index) => (
        <span key={index} className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Chat Message ─────────────────────────────────────────────────
function ChatMessage({ msg, users, onReply, onApproveAlias }: {
  msg: Message;
  users: Record<string, User>;
  onReply?: (msg: Message) => void;
  onApproveAlias?: (candidate: SignatureAliasCandidate, action?: AliasCandidateAction) => void;
}) {
  const user = msg.userId ? users[msg.userId] : null;

  if (msg.type === 'system') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center my-2">
        <div className="bubble-system px-3 py-1.5 rounded-full text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          {msg.content}
        </div>
      </motion.div>
    );
  }

  if (msg.type === 'ai') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-row-reverse gap-3 group">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'var(--ai-bubble-bg)', border: '1px solid var(--ai-bubble-border)' }}>
          <Bot className="w-4 h-4" style={{ color: 'var(--rf-blue-fg)' }} />
        </div>
        <div className="flex max-w-[72%] flex-col items-end space-y-2">
          <div className="flex flex-row-reverse items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--rf-blue-fg)' }}>RF 분석 도우미</span>
            <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
            <Sparkles className="w-3 h-3" style={{ color: 'var(--rf-blue-fg)' }} />
            {onReply && (
              <button
                onClick={() => onReply(msg)}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary ml-auto"
              >
                <Quote className="w-3 h-3" /> 답변
              </button>
            )}
          </div>
          <div className="bubble-ai w-fit max-w-full rounded-xl rounded-tr-sm p-3">
            {msg.replyTo && (
              <div className="mb-2 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] text-foreground/65">
                답변 참조: {msg.replyTo.content}
              </div>
            )}
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            {msg.attachments?.map(attachment => (
              <AttachmentBlock key={attachment.id} attachment={attachment} />
            ))}
          </div>
          {msg.extractedTags && msg.extractedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3" /> 추출된 Signature:
              </span>
              {msg.extractedTags.map((tag, i) => (
                <span key={i} className={tag.isNew ? 'sig-tag-new' : 'sig-tag'}>
                  {tag.isNew && <span style={{ color: 'var(--rf-green-fg)' }}>+</span>}
                  {tag.key}: {tag.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 group">
      <UserAvatar user={user} />
      <div className="flex max-w-[72%] flex-col items-start space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: user?.color }}>{user?.name}</span>
          <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
          {onReply && (
            <button
              onClick={() => onReply(msg)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary ml-auto"
            >
              <Quote className="w-3 h-3" /> 답변
            </button>
          )}
        </div>
        <div className="bubble-user w-fit max-w-full rounded-xl rounded-tl-sm p-3">
          {msg.replyTo && (
            <div className="mb-2 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] text-foreground/65">
              답변 참조: {msg.replyTo.content}
            </div>
          )}
          <p className="text-sm text-foreground/90 leading-relaxed">{msg.content}</p>
          {msg.attachments?.map(attachment => (
            <AttachmentBlock key={attachment.id} attachment={attachment} />
          ))}
          {msg.pendingAliasCandidates && msg.pendingAliasCandidates.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
              <p className="text-[10px] font-semibold text-muted-foreground">동의어 후보</p>
              {msg.pendingAliasCandidates.slice(0, 4).map((candidate, index) => (
                <div key={`${candidate.raw}-${candidate.canonicalKey}-${candidate.canonicalValue}-${index}`} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[10px] text-foreground/80">
                    <span className="font-mono">{candidate.raw}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-mono">{candidate.canonicalKey}:{candidate.canonicalValue}</span>
                  </span>
                  {onApproveAlias && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onApproveAlias(candidate, "canonicalize")}
                        className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        정규화
                      </button>
                      <button
                        type="button"
                        onClick={() => onApproveAlias(candidate, "related")}
                        className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-700 hover:bg-sky-500/15 dark:text-sky-300"
                      >
                        관련어
                      </button>
                      <button
                        type="button"
                        onClick={() => onApproveAlias(candidate, "reject")}
                        className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-500/15 dark:text-red-300"
                      >
                        거부
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── DB Confirm Modal ─────────────────────────────────────────────
function DbConfirmSignatureGroup({ title, signatures }: { title: string; signatures: SignatureTag[] }) {
  if (signatures.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <span className="font-mono text-[10px] text-muted-foreground/60">{signatures.length}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {signatures.map((tag, i) => (
          <div key={`${title}-${tag.key}-${tag.value}-${i}`} className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--card)' }}>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="sig-tag">{tag.key}: {tag.value}</span>
            </div>
            <SignatureMappingDetail tag={tag} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DBConfirmModal({ issue, onClose, onApprove, onReject }: {
  issue: Issue; onClose: () => void; onApprove: () => void; onReject: (reason: string) => void;
}) {
  const [mode, setMode] = useState<'review' | 'reject'>('review');
  const [rejectReason, setRejectReason] = useState('');
  const signatureGroups = splitSignatureTags(issue.signatures);
  const hasAnalysisMappingRisk = signatureGroups.analysisSignatures.some(sig =>
    isAnalysisMappingRisk(getSignatureMappingStatus(sig))
  );
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-2xl rounded-2xl border border-border overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--rf-green-bg)', border: '1px solid var(--rf-green-border)' }}>
              <Database className="w-5 h-5" style={{ color: 'var(--rf-green-fg)' }} />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Knowledge DB 등록 검토</h2>
              <p className="text-xs text-muted-foreground font-mono">{issue.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--panel-surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: 'var(--rf-blue-fg)' }} /> RCA Summary
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-muted-foreground mb-0.5">이슈 제목</p><p className="text-foreground/90 font-medium">{issue.title}</p></div>
              <div><p className="text-muted-foreground mb-0.5">모델 / 단계</p><p className="text-foreground/90 font-mono">{issue.model}</p></div>
              <div><p className="text-muted-foreground mb-0.5">확정 Root Cause</p><p className="font-medium" style={{ color: 'var(--rf-green-fg)' }}>Shield Clip 접촉력 저하 → PIM</p></div>
              <div><p className="text-muted-foreground mb-0.5">개선 방법</p><p className="text-foreground/90">Shield Clip Spring Force 20% 증가</p></div>
            </div>
          </div>
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--panel-surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <Tag className="w-4 h-4" style={{ color: 'var(--rf-blue-fg)' }} /> Signature 태그
            </h3>
            {hasAnalysisMappingRisk && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                미매핑 또는 부분 매핑 Signature가 있어 DB 등록 후 분석/검색 활용이 제한될 수 있습니다.
              </p>
            )}
            <div className="space-y-4">
              <DbConfirmSignatureGroup title="분석 Signature" signatures={signatureGroups.analysisSignatures} />
              <DbConfirmSignatureGroup title="메타데이터" signatures={signatureGroups.metadataTags} />
              <DbConfirmSignatureGroup title="RCA 속성" signatures={signatureGroups.narrativeTags} />
            </div>
          </div>
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--panel-surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--rf-green-fg)' }} /> 승인 체크리스트
            </h3>
            {[
              { ok: true, text: '재현 조건이 명확히 기술되었습니다' },
              { ok: true, text: '측정 데이터(NF Scan)가 첨부되었습니다' },
              { ok: true, text: '기각된 가설과 배제 근거가 기술되었습니다' },
              { ok: false, text: 'Mitigation 결과 검증 데이터가 필요합니다' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {item.ok ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--rf-green-fg)' }} /> : <Info className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--rf-amber-fg)' }} />}
                <span className={item.ok ? 'text-foreground/70' : undefined} style={!item.ok ? { color: 'var(--rf-amber-fg)' } : undefined}>{item.text}</span>
              </div>
            ))}
          </div>
          {mode === 'reject' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl p-4 space-y-2"
              style={{ background: 'var(--rf-red-bg)', border: '1px solid var(--rf-red-border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--rf-red-fg)' }}>반려 사유를 입력하세요</p>
              <textarea
                className="w-full bg-transparent text-sm text-foreground/90 border border-border rounded-lg p-2 resize-none outline-none focus:border-destructive/50"
                rows={3}
                placeholder="예: Mitigation 검증 데이터 첨부 후 재요청 바랍니다."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </motion.div>
          )}
        </div>
        <div className="flex items-center justify-between p-5 border-t border-border">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            단독 분석 모드: <span className="font-medium ml-1" style={{ color: 'var(--rf-amber-fg)' }}>사용자 확인 후 DB 등록</span>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'review' ? (
              <>
                <button onClick={() => setMode('reject')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[0.98]"
                  style={{ background: 'var(--rf-red-bg)', color: 'var(--rf-red-fg)', border: '1px solid var(--rf-red-border)' }}>
                  <X className="w-4 h-4" /> 반려
                </button>
                <button onClick={onApprove}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[0.98]"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', boxShadow: '0 0 20px var(--ring)' }}>
                  <Check className="w-4 h-4" /> DB 등록 승인
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setMode('review')} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">취소</button>
                <button onClick={() => onReject(rejectReason)} disabled={!rejectReason.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                  style={{ background: 'var(--destructive)', color: 'var(--destructive-foreground)' }}>
                  <X className="w-4 h-4" /> 반려 확정
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
interface CreateIssueInput {
  title: string;
  model: string;
  band: string;
  observation: string;
}

function CreateIssueModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateIssueInput) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [model, setModel] = useState('');
  const [band, setBand] = useState('');
  const [observation, setObservation] = useState('');
  const [saving, setSaving] = useState(false);
  const canSubmit = title.trim().length > 0 && model.trim().length > 0 && band.trim().length > 0 && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await onCreate({
        title: title.trim(),
        model: model.trim(),
        band: band.trim(),
        observation: observation.trim(),
      });
    } catch (error) {
      toast.error('Issue creation failed.', { description: error instanceof Error ? error.message : String(error) });
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 14 }}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border"
        style={{ background: 'var(--card)' }}
        onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">새 이슈 생성</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">필수 정보 입력 후 바로 분석 이슈로 전환합니다.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close create issue modal">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Title</span>
            <input value={title} onChange={event => setTitle(event.target.value)}
              className="w-full rounded-lg border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/60"
              placeholder="예: B3 RX sensitivity drop during display ON"
              autoFocus />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Model</span>
              <input value={model} onChange={event => setModel(event.target.value)}
                className="w-full rounded-lg border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/60"
                placeholder="MODEL-X EVT1" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Band</span>
              <input value={band} onChange={event => setBand(event.target.value)}
                className="w-full rounded-lg border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/60"
                placeholder="LTE B3 / NR n78" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Initial observation</span>
            <textarea value={observation} onChange={event => setObservation(event.target.value)}
              className="min-h-28 w-full resize-none rounded-lg border border-border/60 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/60"
              placeholder="측정 조건, 증상, Tx/Rx 조건, 재현 조건을 입력하세요." />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
            취소
          </button>
          <button onClick={submit} disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            생성
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function mergeKnowledgeCases(base: KnowledgeCase[], additions: KnowledgeCase[]): KnowledgeCase[] {
  const merged = new Map<string, KnowledgeCase>();
  for (const item of additions) merged.set(item.id, item);
  for (const item of base) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return Array.from(merged.values());
}

function mergeIssues(base: Issue[], additions: Issue[]): Issue[] {
  const merged = new Map<string, Issue>();
  for (const item of additions) merged.set(item.id, item);
  for (const item of base) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return Array.from(merged.values());
}

function nextIssueId(issues: Issue[]): string {
  const year = new Date().getFullYear();
  const maxNumber = issues.reduce((max, issue) => {
    const match = issue.id.match(/^ISS-\d{4}-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `ISS-${year}-${String(maxNumber + 1).padStart(3, "0")}`;
}

function buildKnowledgeCaseFromIssue(issue: Issue): KnowledgeCase {
  const detail = buildCaseDetailFromIssue(issue);
  return {
    id: `KB-${issue.id}`,
    title: detail.title,
    model: issue.model,
    band: issue.band,
    status: "confirmed",
    confirmedRootCause: detail.rootCause,
    mitigation: Array.isArray(detail.mitigation) ? detail.mitigation.join(" / ") : detail.mitigation,
    symptomPattern: detail.symptomPattern,
    diagnosticTests: detail.diagnosticTests,
    suspectedStructures: detail.suspectedStructures,
    lessonsLearned: Array.isArray(detail.lessonsLearned) ? detail.lessonsLearned.join(" / ") : detail.lessonsLearned,
    decisionRationale: detail.decisionRationale,
    usedMaterials: detail.usedMaterials?.map(persistableAttachment),
    signatures: issue.signatures,
  };
}

function ImportOriginalModal({ candidate, onClose }: { candidate: ImportCandidate; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 14 }}
        className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border"
        style={{ background: 'var(--card)' }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Import 원본 보기</p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{candidate.fileName} · {candidate.caseData.id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close original view">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[1fr_320px]">
          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Raw text</p>
              <span className="text-[10px] text-muted-foreground">{candidate.rawText.length.toLocaleString()} chars</span>
            </div>
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 p-3 text-xs leading-relaxed text-foreground/80" style={{ background: 'var(--panel-surface)' }}>
              {candidate.rawText || 'No readable raw text was extracted from this file.'}
            </pre>
          </section>
          <aside className="min-w-0 space-y-3">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source materials</p>
              <div className="space-y-2">
                {candidate.materials.map(material => (
                  <AttachmentBlock key={material.id} attachment={material} />
                ))}
                {candidate.materials.length === 0 && (
                  <p className="rounded-lg border border-border/60 p-3 text-xs text-muted-foreground">No source material metadata.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3" style={{ background: 'var(--panel-surface)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">1st filter result</p>
              <p className="mt-2 text-xs text-foreground/80">{candidate.status === 'candidate' ? 'Candidate' : 'Hold'} · score {candidate.score}%</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {candidate.caseData.signatures.map((sig, index) => (
                  <span key={`${sig.key}-${sig.value}-${index}`} className="sig-tag text-[10px]">{sig.key}: {sig.value}</span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ImportReviewModal({
  candidates,
  selectedId,
  checkedIds,
  onSelect,
  onToggle,
  onClose,
  onApproveSelected,
  onPromoteHold,
}: {
  candidates: ImportCandidate[];
  selectedId: string;
  checkedIds: string[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onClose: () => void;
  onApproveSelected: () => void;
  onPromoteHold: (id: string) => void;
}) {
  const [originalCandidateId, setOriginalCandidateId] = useState('');
  const selected = candidates.find(candidate => candidate.id === selectedId) ?? candidates[0];
  const originalCandidate = candidates.find(candidate => candidate.id === originalCandidateId);
  const passed = candidates.filter(candidate => candidate.status === 'candidate');
  const held = candidates.filter(candidate => candidate.status === 'hold');
  const selectedCheckedCount = checkedIds.length;
  const selectedInsight = selected
    ? classifyDesenseCase(selected.caseData.signatures, `${selected.caseData.title} ${selected.previewText}`)
    : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }}
        className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border"
        style={{ background: 'var(--card)' }}
        onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
              <ClipboardCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Import 후보 검토</h2>
              <p className="text-[10px] text-muted-foreground">통과 후보 {passed.length}건 · 보류 후보 {held.length}건</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="w-80 flex-shrink-0 overflow-y-auto border-r border-border/60 p-3" style={{ background: 'var(--sidebar)' }}>
            <div className="mb-3 rounded-xl border p-3" style={{ background: 'var(--rf-green-bg)', borderColor: 'var(--rf-green-border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--rf-green-fg)' }}>통과 후보</p>
              <p className="mt-1 text-[10px] text-muted-foreground">체크한 후보만 DB 등록 승인됩니다.</p>
            </div>
            <div className="space-y-2">
              {passed.map(candidate => (
                <div key={candidate.id} className={cn("rounded-lg border p-2.5", selected?.id === candidate.id ? "border-primary/40 bg-primary/10" : "border-border/60 hover:bg-accent")}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={checkedIds.includes(candidate.id)}
                      onChange={() => onToggle(candidate.id)}
                      className="mt-1 h-3.5 w-3.5 accent-primary"
                    />
                    <button onClick={() => onSelect(candidate.id)} className="min-w-0 flex-1 text-left">
                      <p className="line-clamp-2 text-xs font-medium text-foreground/90">{candidate.caseData.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="sig-tag-new text-[9px]">AI 신뢰도 {candidate.score}%</span>
                        <span className="sig-tag text-[9px]">{candidate.caseData.signatures.length} Sig</span>
                        {candidate.duplicateMatch?.duplicate && <span className="sig-tag text-[9px]">Duplicate</span>}
                      </div>
                    </button>
                  </div>
                </div>
              ))}
              {passed.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">통과 후보가 없습니다.</p>}
            </div>

            <div className="mb-3 mt-5 rounded-xl border p-3" style={{ background: 'var(--rf-amber-bg)', borderColor: 'var(--rf-amber-border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--rf-amber-fg)' }}>보류 후보</p>
              <p className="mt-1 text-[10px] text-muted-foreground">자동 등록하지 않고 사유만 확인합니다.</p>
            </div>
            <div className="space-y-2">
              {held.map(candidate => (
                <button
                  key={candidate.id}
                  onClick={() => onSelect(candidate.id)}
                  className={cn("w-full rounded-lg border p-2.5 text-left", selected?.id === candidate.id ? "bg-[var(--rf-amber-bg)] border-[var(--rf-amber-border)]" : "border-border/60 hover:bg-accent")}
                >
                  <p className="line-clamp-2 text-xs font-medium text-foreground/80">{candidate.caseData.title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">AI 신뢰도 {candidate.score}% · 등록 보류</p>
                </button>
              ))}
              {held.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">보류 후보가 없습니다.</p>}
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-4">
            {selected && selectedInsight ? (
              <div className="mx-auto max-w-5xl space-y-4">
                <section className={cn(
                  "rounded-xl border p-4",
                  selected.status === 'candidate' ? "border-[var(--rf-green-border)] bg-[var(--rf-green-bg)]" : "border-[var(--rf-amber-border)] bg-[var(--rf-amber-bg)]"
                )}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">1차 선별 {selected.status === 'candidate' ? '통과' : '보류'} 사유 및 근거</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        매칭 taxonomy: {selectedInsight.category} · 추출 Signature {selected.caseData.signatures.length}개 · AI 신뢰도 {selected.score}%
                      </p>
                    </div>
                    <button onClick={() => setOriginalCandidateId(selected.id)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent">
                      원본 보기
                    </button>
                    {selected.status === 'candidate' && (
                      <button onClick={() => onToggle(selected.id)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-foreground/80 hover:bg-accent">
                        {checkedIds.includes(selected.id) ? '선택 해제' : '등록 후보 선택'}
                      </button>
                    )}
                    {selected.status === 'hold' && (
                      <button onClick={() => onPromoteHold(selected.id)} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-accent" style={{ borderColor: 'var(--rf-amber-border)', color: 'var(--rf-amber-fg)' }}>
                        Review 후 등록 후보 전환
                      </button>
                    )}
                  </div>
                  {selected.duplicateMatch?.matchedCaseId && (
                    <div className={cn(
                      "mt-3 rounded-lg border p-3 text-xs",
                      selected.duplicateMatch.duplicate ? "border-[var(--rf-red-border)] bg-[var(--rf-red-bg)]" : "border-[var(--rf-blue-border)] bg-[var(--rf-blue-bg)]"
                    )}>
                      <p className="font-semibold">
                        {selected.duplicateMatch.duplicate ? 'Duplicate candidate' : 'Closest Knowledge DB match'}: {selected.duplicateMatch.matchedCaseId}
                      </p>
                      <p className="mt-1 text-foreground/70">
                        {selected.duplicateMatch.reason}
                        {typeof selected.duplicateMatch.similarity === 'number' ? ` Similarity ${(selected.duplicateMatch.similarity * 100).toFixed(0)}%.` : ''}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-semibold text-muted-foreground">통과/보류 rule</p>
                      <ul className="space-y-1">
                        {selected.reasons.map((reason, index) => (
                          <li key={index} className="text-xs leading-relaxed text-foreground/75">- {reason}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold text-muted-foreground">원문 근거</p>
                      <ul className="space-y-1">
                        {(selected.evidenceSnippets.length ? selected.evidenceSnippets : [selected.previewText.slice(0, 160)]).map((snippet, index) => (
                          <li key={index} className="text-xs leading-relaxed text-foreground/75">- {snippet}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
                <CaseDetailView data={buildCaseDetailFromKnowledgeCase(selected.caseData)} editable />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Import 후보가 없습니다.</div>
            )}
          </main>
        </div>

        <div className="flex items-center justify-between border-t border-border p-4">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--rf-amber-fg)' }} />
            현재 등록은 브라우저 세션 state에만 반영됩니다.
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">닫기</button>
            <button
              onClick={onApproveSelected}
              disabled={selectedCheckedCount === 0}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              선택 후보 DB 등록 승인 ({selectedCheckedCount})
            </button>
          </div>
        </div>
        <AnimatePresence>
          {originalCandidate && (
            <ImportOriginalModal candidate={originalCandidate} onClose={() => setOriginalCandidateId('')} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function KnowledgeDbWorkspace({
  signatureFilter,
  knowledgeCases,
  customSignatures,
  signatureAliasDictionary,
  signatureWeightRules,
  onChangeSignatureWeightRules,
  onChangeCustomSignatures,
  onFilterKnowledge,
  onAddCase,
  importHistory,
  onImportHistoryChange,
}: {
  signatureFilter?: { key: string; value?: string } | null;
  knowledgeCases: KnowledgeCase[];
  customSignatures: SignatureTag[];
  signatureAliasDictionary: SignatureAliasEntry[];
  signatureWeightRules: SignatureWeightRule[];
  onChangeSignatureWeightRules: (items: SignatureWeightRule[]) => void;
  onChangeCustomSignatures: (items: SignatureTag[]) => void;
  onFilterKnowledge: (filter: { key: string; value?: string } | null) => void;
  onAddCase: (item: KnowledgeCase) => Promise<void>;
  importHistory: ImportApprovalRecord[];
  onImportHistoryChange: (items: ImportApprovalRecord[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState(knowledgeCases[0]?.id ?? '');
  const [workspaceTab, setWorkspaceTab] = useState<'cases' | 'dictionary'>('cases');
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [selectedImportCandidateId, setSelectedImportCandidateId] = useState('');
  const [checkedImportCandidateIds, setCheckedImportCandidateIds] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (signatureFilter) setWorkspaceTab('cases');
  }, [signatureFilter]);

  const categoryCounts = knowledgeCases.reduce<Record<string, number>>((acc, item) => {
    const category = classifyDesenseCase(item.signatures, `${item.title} ${item.confirmedRootCause}`).category;
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  const normalizedQuery = query.trim().toLowerCase();
  const filteredCases = knowledgeCases.filter((item) => {
    const category = classifyDesenseCase(item.signatures, `${item.title} ${item.confirmedRootCause}`).category;
    if (categoryFilter && category !== categoryFilter) return false;
    if (signatureFilter) {
      const matched = item.signatures.some(sig =>
        sig.key.toLowerCase() === signatureFilter.key.toLowerCase() &&
        (!signatureFilter.value || sig.value.toLowerCase() === signatureFilter.value.toLowerCase())
      );
      if (!matched) return false;
    }
    if (!normalizedQuery) return true;
    const haystack = [
      item.id,
      item.title,
      item.model,
      item.band,
      item.status,
      category,
      item.confirmedRootCause,
      item.mitigation,
      ...item.signatures.flatMap(sig => [sig.key, sig.value]),
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const selectedCase: KnowledgeCase | undefined =
    filteredCases.find(item => item.id === selectedCaseId) ?? filteredCases[0] ?? knowledgeCases[0];
  const selectedInsight = selectedCase
    ? classifyDesenseCase(selectedCase.signatures, `${selectedCase.title} ${selectedCase.confirmedRootCause}`)
    : null;

  const handleImportFile = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    try {
      const nextCandidates = await buildImportCandidatesFromFiles(selectedFiles, {
        signatureWeightRules,
        knowledgeCases,
        signatureAliasDictionary,
      });
      setImportCandidates(nextCandidates);
      setSelectedImportCandidateId(nextCandidates[0]?.id ?? '');
      setCheckedImportCandidateIds(nextCandidates.filter(candidate => candidate.status === 'candidate' && !candidate.duplicateMatch?.duplicate).map(candidate => candidate.id));
    } catch {
      toast.error('Import 파일을 읽지 못했습니다.');
    }
  };

  const toggleImportCandidate = (id: string) => {
    setCheckedImportCandidateIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const promoteHoldCandidate = (id: string) => {
    setImportCandidates(prev => prev.map(candidate => candidate.id === id ? {
      ...candidate,
      status: 'candidate',
      score: Math.max(candidate.score, 55),
      reasons: [...candidate.reasons, 'Reviewer promoted this held candidate for Knowledge DB approval.'],
      statusDecision: {
        ...candidate.statusDecision,
        status: 'candidate',
        score: Math.max(candidate.score, 55),
        ruleIds: [...candidate.statusDecision.ruleIds, 'reviewer-promoted'],
        explanation: 'Reviewer promoted this held candidate after manual review.',
      },
    } : candidate));
    setCheckedImportCandidateIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const approveImportCandidates = async () => {
    const approved = importCandidates.filter(candidate => candidate.status === 'candidate' && checkedImportCandidateIds.includes(candidate.id));
    if (!approved.length) return;
    const existingKeys = new Set(knowledgeCases.map(normalizeCaseKey));
    const accepted: ImportCandidate[] = [];
    const skipped: ImportCandidate[] = [];
    for (const candidate of approved) {
      const key = normalizeCaseKey(candidate.caseData);
      const duplicate = candidate.duplicateMatch ?? findDuplicateImportCase(candidate.caseData, knowledgeCases, signatureAliasDictionary);
      if (duplicate.duplicate || existingKeys.has(key)) {
        skipped.push(candidate);
        continue;
      }
      existingKeys.add(key);
      accepted.push(candidate);
    }
    if (!accepted.length) {
      toast.warning('Import 후보가 모두 중복으로 판단되어 등록하지 않았습니다.');
      return;
    }
    try {
      await Promise.all(accepted.map(candidate => onAddCase({
        ...candidate.caseData,
        usedMaterials: candidate.caseData.usedMaterials?.map(persistableAttachment),
      })));
      const savedImport = await saveImportApproval({
        id: makeImportId('import-result'),
        createdAt: new Date().toISOString(),
        sourceFileNames: Array.from(new Set(importCandidates.map(candidate => candidate.fileName))),
        approvedCaseIds: accepted.map(candidate => candidate.caseData.id),
        skippedDuplicateCaseIds: skipped.map(candidate => candidate.caseData.id),
        heldCount: importCandidates.filter(candidate => candidate.status === 'hold').length,
        candidateCount: importCandidates.length,
      });
      onImportHistoryChange([savedImport, ...importHistory.filter(item => item.id !== savedImport.id)]);
    } catch (error) {
      toast.error('Knowledge DB 저장 API 호출에 실패했습니다.', { description: error instanceof Error ? error.message : String(error) });
      return;
    }
    setSelectedCaseId(accepted[0].caseData.id);
    setWorkspaceTab('cases');
    setImportCandidates([]);
    setSelectedImportCandidateId('');
    setCheckedImportCandidateIds([]);
    toast.success('Knowledge DB 후보가 저장되었습니다.', { description: `${accepted.length}건 등록${skipped.length ? `, 중복 ${skipped.length}건 제외` : ''}` });
  };

  if (workspaceTab === 'dictionary') {
    return (
      <SignatureDictionaryWorkspace
        knowledgeCases={knowledgeCases}
        customSignatures={customSignatures}
        signatureAliasDictionary={signatureAliasDictionary}
        signatureWeightRules={signatureWeightRules}
        onChangeSignatureWeightRules={onChangeSignatureWeightRules}
        onChangeCustomSignatures={onChangeCustomSignatures}
        onFilterKnowledge={(filter) => {
          onFilterKnowledge(filter);
          setWorkspaceTab('cases');
        }}
        onShowCases={() => setWorkspaceTab('cases')}
      />
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-80 flex-shrink-0 border-r border-border/60 flex flex-col overflow-hidden" style={{ background: 'var(--sidebar)' }}>
        <div className="p-3 border-b border-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground/90">Knowledge DB</p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{filteredCases.length}건</span>
              <input
                ref={importInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".txt,.csv,.tsv,.json,.md,.xlsx,.xls,image/*"
                onChange={event => {
                  handleImportFile(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Upload className="h-3 w-3" />
                Import
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 rounded-lg border border-border/60 p-0.5" style={{ background: 'var(--panel-surface)' }}>
            <button className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">사례</button>
            <button onClick={() => setWorkspaceTab('dictionary')} className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Signature 사전</button>
          </div>
          {signatureFilter && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5 text-[10px] text-primary">
              <div className="flex items-center justify-between gap-2">
                <span>Signature 필터: {signatureFilter.key}{signatureFilter.value ? ` = ${signatureFilter.value}` : ''}</span>
                <button onClick={() => onFilterKnowledge(null)} className="text-[10px] underline">해제</button>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5" style={{ background: 'var(--panel-surface)' }}>
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
              placeholder="증상, 밴드, 원인, 시그니처 검색"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground">원인 분류 색인</p>
              {categoryFilter && (
                <button className="text-[10px] text-primary hover:underline" onClick={() => setCategoryFilter('')}>
                  전체
                </button>
              )}
            </div>
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
              {Object.entries(categoryCounts).map(([category, count]) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(categoryFilter === category ? '' : category)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                    categoryFilter === category
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {category} · {count}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground">Import history</p>
              <span className="text-[10px] text-muted-foreground">{importHistory.length}</span>
            </div>
            <div className="max-h-24 space-y-1 overflow-y-auto">
              {importHistory.slice(0, 4).map(record => (
                <div key={record.id} className="rounded-md border border-border/50 px-2 py-1 text-[10px] text-muted-foreground">
                  <p className="truncate text-foreground/80">{record.sourceFileNames.join(', ') || record.id}</p>
                  <p>approved {record.approvedCaseIds.length} · skipped {record.skippedDuplicateCaseIds.length} · held {record.heldCount}</p>
                </div>
              ))}
              {importHistory.length === 0 && <p className="text-[10px] text-muted-foreground">No import history yet.</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredCases.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedCaseId(item.id)}
              className={cn(
                "w-full rounded-lg border p-2.5 text-left transition-colors",
                selectedCase?.id === item.id ? "border-primary/30 bg-primary/10" : "border-transparent hover:bg-accent"
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{item.id}</span>
                <span
                  className="rounded-full border px-1.5 py-0.5 text-[9px]"
                  style={item.status === 'confirmed'
                    ? { background: 'var(--rf-green-bg)', borderColor: 'var(--rf-green-border)', color: 'var(--rf-green-fg)' }
                    : { background: 'var(--rf-blue-bg)', borderColor: 'var(--rf-blue-border)', color: 'var(--rf-blue-fg)' }}
                >
                  {item.status === 'confirmed' ? '확정' : '검증'}
                </span>
              </div>
              <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground/90">{item.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="sig-tag text-[10px]">{item.band}</span>
                <span className="sig-tag text-[10px]">{item.model}</span>
                <span className="sig-tag text-[10px]">
                  {classifyDesenseCase(item.signatures, `${item.title} ${item.confirmedRootCause}`).category}
                </span>
              </div>
            </button>
          ))}

          {filteredCases.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-5" style={{ background: 'var(--background)' }}>
        {selectedCase ? (
          <div className="mx-auto max-w-5xl">
            <CaseDetailView data={buildCaseDetailFromKnowledgeCase(selectedCase)} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            선택할 Knowledge DB 사례가 없습니다.
          </div>
        )}
      </main>

      <AnimatePresence>
        {importCandidates.length > 0 && (
          <ImportReviewModal
            candidates={importCandidates}
            selectedId={selectedImportCandidateId}
            checkedIds={checkedImportCandidateIds}
            onSelect={setSelectedImportCandidateId}
            onToggle={toggleImportCandidate}
            onClose={() => {
              setImportCandidates([]);
              setSelectedImportCandidateId('');
              setCheckedImportCandidateIds([]);
            }}
            onApproveSelected={approveImportCandidates}
            onPromoteHold={promoteHoldCandidate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RagOpsPanel() {
  const [report, setReport] = useState<RagOpsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextReport = await loadRagOpsReport();
      setReport(nextReport);
      if (nextReport.verdict === 'FAIL') {
        toast.error('RAG 점검 실패', { description: `${nextReport.errors.length}개 오류가 있습니다.` });
      } else if (nextReport.verdict === 'WARN') {
        toast.warning('RAG 점검 경고', { description: `${nextReport.warnings.length}개 경고가 있습니다.` });
      } else {
        toast.success('RAG 점검 통과');
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      toast.error('RAG 점검 API를 사용할 수 없습니다.', { description: message });
    } finally {
      setLoading(false);
    }
  };

  const verdictStyle = report?.verdict === 'FAIL'
    ? { background: 'var(--rf-red-bg)', borderColor: 'var(--rf-red-border)', color: 'var(--rf-red-fg)' }
    : report?.verdict === 'WARN'
    ? { background: 'var(--rf-amber-bg)', borderColor: 'var(--rf-amber-border)', color: 'var(--rf-amber-fg)' }
    : { background: 'var(--rf-green-bg)', borderColor: 'var(--rf-green-border)', color: 'var(--rf-green-fg)' };

  return (
    <div className="rounded-xl border border-border/70 p-3" style={{ background: 'var(--card)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">RAG 운영 점검</p>
            {report && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={verdictStyle}>
                {report.verdict}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Public Wiki, Knowledge case excerpt, OpenAI 공개 범위 누출 여부를 수동으로 확인합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          RAG 점검 실행
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--rf-red-bg)', borderColor: 'var(--rf-red-border)', color: 'var(--rf-red-fg)' }}>
          현재 점검 API를 사용할 수 없습니다. {error}
        </div>
      )}

      {report ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
              <p className="text-[10px] text-muted-foreground">Public Wiki</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{report.counts.publicWikiDocuments}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
              <p className="text-[10px] text-muted-foreground">Confirmed DB</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{report.counts.confirmedKnowledgeCases ?? report.counts.knowledgeCaseExcerpts}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
              <p className="text-[10px] text-muted-foreground">Case Excerpt</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{report.counts.knowledgeCaseExcerpts}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
              <p className="text-[10px] text-muted-foreground">RAG 제외</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{report.counts.nonConfirmedKnowledgeCases ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
              <p className="text-[10px] text-muted-foreground">OpenAI Probe</p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">{report.counts.openAiProbeSnippets}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground">최근 점검: {new Date(report.generatedAt).toLocaleString()}</p>
            {report.errors.length === 0 && report.warnings.length === 0 ? (
              <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--rf-green-bg)', borderColor: 'var(--rf-green-border)', color: 'var(--rf-green-fg)' }}>
                문제 없음. RAG source 정책과 OpenAI 공개 범위가 정상입니다.
              </div>
            ) : (
              <div className="space-y-1.5">
                {report.errors.map(item => (
                  <div key={item} className="rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--rf-red-bg)', borderColor: 'var(--rf-red-border)', color: 'var(--rf-red-fg)' }}>
                    FAIL: {item}
                  </div>
                ))}
                {report.warnings.map(item => (
                  <div key={item} className="rounded-lg border px-3 py-2 text-xs" style={{ background: 'var(--rf-amber-bg)', borderColor: 'var(--rf-amber-border)', color: 'var(--rf-amber-fg)' }}>
                    WARN: {item}
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg border border-border/60 p-2" style={{ background: 'var(--panel-surface)' }}>
              <p className="mb-1 text-[10px] font-semibold text-muted-foreground">다음 조치</p>
              <ul className="space-y-1 text-[10px] text-muted-foreground">
                {report.nextActions.map(item => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          아직 실행된 점검이 없습니다. 버튼을 누르면 서버가 현재 RAG source 상태를 읽어 보고서만 생성합니다.
        </p>
      )}
    </div>
  );
}

function SignatureDictionaryWorkspace({
  knowledgeCases,
  customSignatures,
  signatureAliasDictionary,
  signatureWeightRules,
  onChangeSignatureWeightRules,
  onChangeCustomSignatures,
  onFilterKnowledge,
  onShowCases,
}: {
  knowledgeCases: KnowledgeCase[];
  customSignatures: SignatureTag[];
  signatureAliasDictionary: SignatureAliasEntry[];
  signatureWeightRules: SignatureWeightRule[];
  onChangeSignatureWeightRules: (items: SignatureWeightRule[]) => void;
  onChangeCustomSignatures: (items: SignatureTag[]) => void;
  onFilterKnowledge: (filter: { key: string; value?: string }) => void;
  onShowCases: () => void;
}) {
  const [query, setQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const [showWeightSettings, setShowWeightSettings] = useState(false);
  const draftMapping = useMemo(
    () => getSignatureMappingStatus({ key: draftKey.trim(), value: draftValue.trim() }),
    [draftKey, draftValue]
  );

  const entries = useMemo(() => {
    const map = new Map<string, { key: string; value: string; count: number; caseIds: string[]; source: 'db' | 'user'; mapping: SignatureMappingStatus }>();
    for (const kc of knowledgeCases) {
      for (const sig of kc.signatures) {
        const id = `${sig.key}|||${sig.value}`;
        const current = map.get(id) ?? { key: sig.key, value: sig.value, count: 0, caseIds: [], source: 'db' as const, mapping: getSignatureMappingStatus(sig) };
        current.count += 1;
        current.caseIds.push(kc.id);
        map.set(id, current);
      }
    }
    for (const sig of customSignatures) {
      const id = `${sig.key}|||${sig.value}`;
      const current = map.get(id) ?? { key: sig.key, value: sig.value, count: 0, caseIds: [], source: 'user' as const, mapping: getSignatureMappingStatus(sig) };
      current.source = 'user';
      map.set(id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [customSignatures, knowledgeCases]);

  const mergedAliasDictionary = useMemo(
    () => mergeSignatureAliasDictionaries(signatureAliasDictionary),
    [signatureAliasDictionary]
  );
  const approvedAliasDictionary = useMemo(
    () => mergedAliasDictionary.filter(item => (item.status ?? "approved") === "approved"),
    [mergedAliasDictionary]
  );
  const autoCanonicalAliasCount = useMemo(
    () => approvedAliasDictionary.filter(canAutoCanonicalizeAlias).length,
    [approvedAliasDictionary]
  );
  const relatedAliasCount = useMemo(
    () => getRelatedAliasDictionary(approvedAliasDictionary).length,
    [approvedAliasDictionary]
  );
  const userAliasEntries = useMemo(
    () => signatureAliasDictionary.filter(item => (item.status ?? "approved") === "approved"),
    [signatureAliasDictionary]
  );
  const aliasesBySignature = useMemo(() => {
    const map = new Map<string, SignatureAliasEntry[]>();
    for (const entry of mergedAliasDictionary) {
      const key = `${normalizeAliasToken(entry.canonicalKey)}|||${normalizeAliasToken(entry.canonicalValue)}`;
      const current = map.get(key) ?? [];
      current.push(entry);
      map.set(key, current);
    }
    return map;
  }, [mergedAliasDictionary]);

  const filtered = entries.filter(item => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${item.key} ${item.value} ${item.mapping.label} ${item.mapping.detail ?? ''} ${item.caseIds.join(' ')}`.toLowerCase().includes(needle);
  });
  const groupedFiltered = [
    { title: "분석 Signature", items: filtered.filter(item => item.mapping.tone !== "metadata" && item.mapping.tone !== "narrative") },
    { title: "메타데이터", items: filtered.filter(item => item.mapping.tone === "metadata") },
    { title: "RCA 속성", items: filtered.filter(item => item.mapping.tone === "narrative") },
  ];

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setDraftKey(customSignatures[index]?.key ?? '');
    setDraftValue(customSignatures[index]?.value ?? '');
  };

  const saveCustom = () => {
    if (!draftKey.trim() || !draftValue.trim()) return;
    if (editingIndex === null) {
      onChangeCustomSignatures([...customSignatures, { key: draftKey.trim(), value: draftValue.trim(), isNew: true }]);
    } else {
      onChangeCustomSignatures(customSignatures.map((item, idx) => idx === editingIndex ? { ...item, key: draftKey.trim(), value: draftValue.trim() } : item));
    }
    const savedMapping = getSignatureMappingStatus({ key: draftKey.trim(), value: draftValue.trim() });
    if (savedMapping.tone === "unmapped") {
      toast.warning("미매핑 Signature로 저장했습니다.", { description: "표시/필터에는 사용되지만 Local Engine 분석 영향은 제한됩니다." });
    } else if (savedMapping.tone === "partial") {
      toast("Key만 매핑된 Signature로 저장했습니다.", { description: "Value는 기존 canonical value나 alias 승인 후 더 안정적으로 분석에 반영됩니다." });
    }
    setEditingIndex(null);
    setDraftKey('');
    setDraftValue('');
  };

  const deleteCustom = (index: number) => {
    const removed = customSignatures[index];
    const next = customSignatures.filter((_, idx) => idx !== index);
    onChangeCustomSignatures(next);
    toast('사용자 Signature 삭제됨', {
      action: { label: '실행 취소', onClick: () => onChangeCustomSignatures([...next.slice(0, index), removed, ...next.slice(index)]) },
    });
  };

  const keyCounts = entries.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = (acc[item.key] ?? 0) + item.count;
    return acc;
  }, {});

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-80 flex-shrink-0 flex-col overflow-hidden border-r border-border/60 p-3" style={{ background: 'var(--sidebar)' }}>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-foreground/90">Signature 사전</p>
            <p className="mt-1 text-[10px] text-muted-foreground">전체 key/value, 빈도, 연결 사례를 관리합니다.</p>
          </div>
          <div className="grid grid-cols-2 rounded-lg border border-border/60 p-0.5" style={{ background: 'var(--panel-surface)' }}>
            <button onClick={onShowCases} className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">사례</button>
            <button className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Signature 사전</button>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5" style={{ background: 'var(--panel-surface)' }}>
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="key, value, case id 검색" />
          </div>
          <div className="rounded-lg border border-border/60 p-3" style={{ background: 'var(--panel-surface)' }}>
            <p className="mb-2 text-[10px] font-semibold text-muted-foreground">사용자 Signature 추가/편집</p>
            <div className="space-y-2">
              <input value={draftKey} onChange={e => setDraftKey(e.target.value)} className="w-full rounded-md border border-border/60 bg-transparent px-2 py-1.5 text-xs outline-none" placeholder="Key" />
              <input value={draftValue} onChange={e => setDraftValue(e.target.value)} className="w-full rounded-md border border-border/60 bg-transparent px-2 py-1.5 text-xs outline-none" placeholder="Value" />
              {(draftKey.trim() || draftValue.trim()) && (
                <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <SignatureMappingBadge tag={{ key: draftKey.trim(), value: draftValue.trim() }} />
                    {draftMapping.detail && <span className="truncate font-mono">{draftMapping.detail}</span>}
                  </div>
                  <p className="mt-1 leading-snug">{draftMapping.description}</p>
                </div>
              )}
              <button onClick={saveCustom} disabled={!draftKey.trim() || !draftValue.trim()} className="w-full rounded-md bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40">
                {editingIndex === null ? '추가' : '저장'}
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3" style={{ background: 'var(--panel-surface)' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-muted-foreground">Alias 운영 상태</p>
              <span className="font-mono text-[10px] text-muted-foreground/70">{userAliasEntries.length} user</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-emerald-700 dark:text-emerald-300">
                <p className="font-semibold">자동 정규화</p>
                <p className="font-mono">{autoCanonicalAliasCount}</p>
              </div>
              <div className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1.5 text-sky-700 dark:text-sky-300">
                <p className="font-semibold">RAG 확장</p>
                <p className="font-mono">{relatedAliasCount}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              synonym/alias/약어/번역어는 자동 정규화에 쓰고, related/원인/측정 관계는 signature를 바꾸지 않고 RAG 검색 확장에만 씁니다.
            </p>
          </div>
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 p-3" style={{ background: 'var(--panel-surface)' }}>
            <p className="mb-2 text-[10px] font-semibold text-muted-foreground">Key별 빈도</p>
            <div className="flex min-h-0 flex-1 content-start flex-wrap gap-1 overflow-y-auto pr-1">
              {Object.entries(keyCounts).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                <button key={key} onClick={() => onFilterKnowledge({ key })} className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground">
                  {key} · {count}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-5" style={{ background: 'var(--background)' }}>
        <div className="mx-auto max-w-6xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{showWeightSettings ? 'Signature Weight 설정' : 'Signature 목록'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {showWeightSettings ? '분석, 검색, 워크플로우 목적별 Signature key 중요도를 관리합니다.' : `${filtered.length}개 key/value 항목`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowWeightSettings(prev => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                showWeightSettings ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {showWeightSettings ? '목록 보기' : 'Weight 설정'}
            </button>
          </div>
          <RagOpsPanel />
          {showWeightSettings ? (
            <SignatureWeightSettings
              rules={signatureWeightRules}
              onUpdate={onChangeSignatureWeightRules}
              variant="wide"
            />
          ) : (
            <div className="space-y-4">
          {groupedFiltered.filter(group => group.items.length > 0).map(group => (
            <section key={group.title} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                <span className="font-mono text-[10px] text-muted-foreground/60">{group.items.length}</span>
              </div>
              <div className="grid gap-2">
          {group.items.map(item => {
            const customIndex = customSignatures.findIndex(sig => sig.key === item.key && sig.value === item.value);
            const itemAliases = aliasesBySignature.get(`${normalizeAliasToken(item.key)}|||${normalizeAliasToken(item.value)}`) ?? [];
            return (
              <div key={`${item.key}-${item.value}`} className="rounded-xl border border-border/70 p-3" style={{ background: 'var(--card)' }}>
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 text-left" onClick={() => onFilterKnowledge({ key: item.key, value: item.value })}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-primary">{item.key}</span>
                      <span className="text-xs text-foreground/90">{item.value}</span>
                      {item.source === 'user' && <span className="sig-tag-new text-[10px]">사용자</span>}
                      <SignatureMappingBadge tag={item} />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      연결 사례 {item.caseIds.length}건 {item.caseIds.length ? `· ${item.caseIds.slice(0, 4).join(', ')}` : '· 아직 DB 연결 없음'}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {item.mapping.detail ? `${item.mapping.detail} · ` : ''}{item.mapping.description}
                    </p>
                    {itemAliases.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {itemAliases.slice(0, 3).map(alias => (
                          <span
                            key={`${alias.id}-${alias.relationType ?? 'alias'}`}
                            className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", aliasUsageClass(alias))}
                            title={`${aliasRelationLabel(alias)}: ${alias.aliases.join(', ')}`}
                          >
                            {aliasUsageLabel(alias)} · {aliasRelationLabel(alias)}
                          </span>
                        ))}
                        {itemAliases.length > 3 && (
                          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                            +{itemAliases.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    {item.mapping.tone !== "mapped" && <SignatureMappingDetail tag={item} className="mt-2" />}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">빈도 {item.count}</span>
                    {customIndex >= 0 && (
                      <>
                        <button onClick={() => startEdit(customIndex)} className="text-[10px] hover:underline" style={{ color: 'var(--rf-blue-fg)' }}>편집</button>
                        <button onClick={() => deleteCustom(customIndex)} className="text-[10px] hover:underline" style={{ color: 'var(--rf-red-fg)' }}>삭제</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
              </div>
            </section>
          ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {

  const [activeView, setActiveView] = useState<'issues' | 'knowledge'>('issues');
  const [selectedIssueId, setSelectedIssueId] = useState(MOCK_ISSUES[0].id);
  const [issues, setIssues] = useState(MOCK_ISSUES);
  const [knowledgeCases, setKnowledgeCases] = useState<KnowledgeCase[]>(DEFAULT_KNOWLEDGE_CASES);
  const [importHistory, setImportHistory] = useState<ImportApprovalRecord[]>([]);
  const [customDictionarySignatures, setCustomDictionarySignatures] = useState<SignatureTag[]>([]);
  const [signatureAliasDictionary, setSignatureAliasDictionary] = useState<SignatureAliasEntry[]>([]);
  const [signatureWeightRules, setSignatureWeightRules] = useState<SignatureWeightRule[]>(() => mergeSignatureWeightRules());
  const [knowledgeSignatureFilter, setKnowledgeSignatureFilter] = useState<{ key: string; value?: string } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [quotedText, setQuotedText] = useState<{ text: string; source: string } | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRcaModal, setShowRcaModal] = useState(false);
  const [activePanel, setActivePanel] = useState<'hypotheses' | 'signatures' | 'similar' | 'summary' | 'timeline'>('summary');
  const [userDirectory, setUserDirectory] = useState<Record<string, User>>(() => readStoredUsers());
  const [currentUserId, setCurrentUserId] = useState(() => readStoredCurrentUserId(readStoredUsers()));
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userNameInput, setUserNameInput] = useState('');
  const [userInitialsInput, setUserInitialsInput] = useState('');
  const [persistenceAvailable, setPersistenceAvailable] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(520); // resizable
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(0);

  const selectedIssue = issues.find(i => i.id === selectedIssueId) ?? issues[0];
  const currentUser = userDirectory[currentUserId] ?? USERS.kim;
  const canOpenRcaDraft =
    !!selectedIssue &&
    selectedIssue.status !== 'confirmed' &&
    selectedIssue.status !== 'archived' &&
    selectedIssue.hypotheses.some(h => h.status === 'validated' || h.confidence >= 70);

  useEffect(() => {
    let cancelled = false;
    loadRfFipDb()
      .then((snapshot) => {
        if (cancelled) return;
        setIssues(mergeIssues(MOCK_ISSUES, snapshot.issues));
        setKnowledgeCases(mergeKnowledgeCases(DEFAULT_KNOWLEDGE_CASES, snapshot.knowledgeCases));
        setCustomDictionarySignatures(snapshot.signatureDictionary);
        setSignatureAliasDictionary(snapshot.signatureAliasDictionary);
        setSignatureWeightRules(mergeSignatureWeightRules(snapshot.signatureWeightRules));
        setImportHistory(snapshot.importResults);
        setPersistenceAvailable(snapshot.persistenceAvailable === true);
      })
      .catch((error) => {
        toast.error('Persisted DB load failed.', { description: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (issues.length > 0 && !issues.some(issue => issue.id === selectedIssueId)) {
      setSelectedIssueId(issues[0].id);
    }
  }, [issues, selectedIssueId]);

  const persistKnowledgeCase = async (item: KnowledgeCase) => {
    const persistableCase: KnowledgeCase = {
      ...item,
      usedMaterials: item.usedMaterials?.map(persistableAttachment),
    };
    await saveKnowledgeCase(persistableCase);
    setKnowledgeCases(prev => mergeKnowledgeCases(prev, [persistableCase]));
  };

  const updateCustomDictionarySignatures = (items: SignatureTag[]) => {
    setCustomDictionarySignatures(items);
    saveSignatureDictionary(items).catch((error) => {
      toast.error('Signature Dictionary save failed.', { description: error instanceof Error ? error.message : String(error) });
    });
  };

  const updateSignatureAliasDictionary = (items: SignatureAliasEntry[]) => {
    setSignatureAliasDictionary(items);
    saveSignatureAliases(items).catch((error) => {
      toast.error('Signature alias save failed.', { description: error instanceof Error ? error.message : String(error) });
    });
  };

  const approveAliasCandidate = (candidate: SignatureAliasCandidate, action: AliasCandidateAction = "canonicalize") => {
    const rawAlias = candidate.raw.trim();
    if (!rawAlias) return;
    const builtin = SIGNATURE_ALIAS_DICTIONARY.find(entry =>
      normalizeAliasToken(entry.canonicalKey) === normalizeAliasToken(candidate.canonicalKey) &&
      normalizeAliasToken(entry.canonicalValue) === normalizeAliasToken(candidate.canonicalValue)
    );
    const relationType: SignatureAliasRelationType = action === "related"
      ? "related_to"
      : action === "reject"
      ? "reject"
      : "alias";
    const usageText = action === "related"
      ? "RAG 검색 확장 관련어"
      : action === "reject"
      ? "거부 alias"
      : "자동 정규화 alias";
    const approvedDictionary = mergeSignatureAliasDictionaries(signatureAliasDictionary);
    const alreadyApproved = approvedDictionary.some(entry =>
      normalizeAliasToken(entry.canonicalKey) === normalizeAliasToken(candidate.canonicalKey) &&
      normalizeAliasToken(entry.canonicalValue) === normalizeAliasToken(candidate.canonicalValue) &&
      (entry.relationType ?? 'alias') === relationType &&
      [entry.canonicalValue, ...entry.aliases].some(alias => normalizeAliasToken(alias) === normalizeAliasToken(rawAlias))
    );
    if (alreadyApproved) {
      toast.info('이미 저장된 alias입니다.', { description: `${rawAlias} · ${usageText}` });
      return;
    }

    const cleaned = signatureAliasDictionary
      .map(entry => {
        if (
          normalizeAliasToken(entry.canonicalKey) !== normalizeAliasToken(candidate.canonicalKey) ||
          normalizeAliasToken(entry.canonicalValue) !== normalizeAliasToken(candidate.canonicalValue)
        ) {
          return entry;
        }
        return {
          ...entry,
          aliases: entry.aliases.filter(alias => normalizeAliasToken(alias) !== normalizeAliasToken(rawAlias)),
        };
      })
      .filter(entry => entry.source === 'builtin' || entry.aliases.length > 0);

    const existingIndex = cleaned.findIndex(entry =>
      normalizeAliasToken(entry.canonicalKey) === normalizeAliasToken(candidate.canonicalKey) &&
      normalizeAliasToken(entry.canonicalValue) === normalizeAliasToken(candidate.canonicalValue) &&
      (entry.relationType ?? 'alias') === relationType &&
      (entry.status ?? 'approved') === 'approved'
    );
    const next = [...cleaned];
    if (existingIndex >= 0) {
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        aliases: Array.from(new Set([...existing.aliases, rawAlias])),
        aliasType: existing.aliasType ?? 'semantic_alias',
        relationType,
        source: existing.source ?? 'user-approved',
        status: 'approved',
      };
    } else {
      next.push({
        id: `alias-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        canonicalKey: candidate.canonicalKey,
        canonicalValue: candidate.canonicalValue,
        aliases: [rawAlias],
        domain: builtin?.domain ?? 'rf',
        status: 'approved',
        confidence: candidate.score,
        source: 'user-approved',
        aliasType: 'semantic_alias',
        relationType,
        conceptId: builtin?.conceptId,
        valueId: builtin?.valueId,
      });
    }
    updateSignatureAliasDictionary(next);
    toast.success('Alias 후보를 저장했습니다.', { description: `${rawAlias} → ${candidate.canonicalKey}:${candidate.canonicalValue} · ${usageText}` });
  };

  const updateSignatureWeightRules = (items: SignatureWeightRule[]) => {
    const merged = mergeSignatureWeightRules(items);
    setSignatureWeightRules(merged);
    saveSignatureWeightRules(merged).catch((error) => {
      toast.error('Signature weight rules save failed.', { description: error instanceof Error ? error.message : String(error) });
    });
  };

  const openUserEditor = () => {
    setUserNameInput(currentUser.name);
    setUserInitialsInput(currentUser.initials);
    setIsEditingUser(true);
  };

  const applyCurrentUser = () => {
    const name = userNameInput.trim();
    if (!name) {
      toast.error('사용자 이름을 입력해주세요.');
      return;
    }
    const id = makeUserId(name);
    const nextUser: User = {
      id,
      name,
      initials: (userInitialsInput.trim() || makeInitials(name)).slice(0, 3).toUpperCase(),
      role: 'junior',
      color: userDirectory[id]?.color ?? colorForUserId(id),
    };
    const nextDirectory = { ...userDirectory, [id]: nextUser };
    setUserDirectory(nextDirectory);
    setCurrentUserId(id);
    persistUserSelection(nextDirectory, id);
    setIsEditingUser(false);
    toast.success('현재 사용자를 변경했습니다.', { description: nextUser.name });
  };

  const handleCreateIssue = async (input: CreateIssueInput) => {
    const id = nextIssueId(issues);
    const now = new Date();
    const seedText = `${input.title}\n${input.band}\n${input.observation}`;
    const extracted = mergeSignatures([{ key: 'Band', value: input.band, isNew: true }], extractRfSignatures(seedText, signatureAliasDictionary), signatureAliasDictionary);
    const messages: Message[] = [
      {
        id: `m-${Date.now()}-system`,
        type: 'system',
        content: '새 RF 분석 이슈가 생성되었습니다.',
        timestamp: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    if (input.observation) {
      messages.push({
        id: `m-${Date.now()}-user`,
        type: 'user',
        userId: currentUser.id,
        content: input.observation,
        timestamp: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    const nextIssue: Issue = {
      id,
      title: input.title,
      model: input.model,
      band: input.band,
      status: 'new',
      createdAt: now.toISOString().slice(0, 10),
      assignee: currentUser.id,
      messages,
      signatures: extracted,
      hypotheses: [],
    };
    const saved = await saveIssue(nextIssue);
    setIssues(prev => mergeIssues(prev, [saved]));
    setSelectedIssueId(saved.id);
    setActiveView('issues');
    setShowCreateIssueModal(false);
    setActivePanel('summary');
    toast.success('새 이슈가 생성되었습니다.', { description: saved.id });
  };

  const handleRemoveIssueFromList = async (issue: Issue) => {
    if (!canRemoveIssueFromList(issue)) return;
    const confirmed = window.confirm(`${issue.id}를 이슈 목록에서 삭제할까요?\nKnowledge DB 사례는 삭제되지 않습니다.`);
    if (!confirmed) return;

    const previousIssues = issues;
    const nextIssues = issues.filter(item => item.id !== issue.id);
    setIssues(nextIssues);
    if (selectedIssueId === issue.id) {
      setSelectedIssueId(nextIssues[0]?.id ?? '');
    }

    try {
      await replaceIssues(nextIssues.map(toPersistableIssue));
      toast.success('이슈 목록에서 삭제했습니다.', { description: 'Knowledge DB는 변경하지 않았습니다.' });
    } catch (error) {
      setIssues(previousIssues);
      setSelectedIssueId(selectedIssueId);
      toast.error('이슈 목록 삭제 저장에 실패했습니다.', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleRemoveIssueFromListWithRiskConfirm = async (issue: Issue) => {
    const isConfirmedIssue = issue.status === 'confirmed';
    if (isConfirmedIssue) {
      const confirmed = window.confirm(`${issue.id}를 이슈 목록에서 삭제할까요?\nKnowledge DB 사례는 삭제되지 않습니다.`);
      if (!confirmed) return;
    } else {
      const riskAccepted = window.confirm(
        `${issue.id}는 확정 사례가 아니므로 Knowledge DB에 저장된 사례가 아닙니다.\n삭제하면 현재 이슈 목록과 진행 중 분석 기록에서 제거됩니다.`
      );
      if (!riskAccepted) return;
      const finalAccepted = window.confirm('정말 삭제할까요? 이 작업은 현재 이슈 목록에서 제거됩니다.');
      if (!finalAccepted) return;
    }

    const previousIssues = issues;
    const nextIssues = issues.filter(item => item.id !== issue.id);
    setIssues(nextIssues);
    if (selectedIssueId === issue.id) {
      setSelectedIssueId(nextIssues[0]?.id ?? '');
    }

    try {
      await replaceIssues(nextIssues.map(toPersistableIssue));
      const sessionOnly = persistenceAvailable ? '' : ' 현재 세션에만 반영됩니다.';
      if (isConfirmedIssue) {
        toast.success('이슈 목록에서 삭제했습니다.', { description: `Knowledge DB는 변경하지 않았습니다.${sessionOnly}` });
      } else {
        const statusLabel = ISSUE_DELETE_STATUS_LABEL[issue.status] ?? issue.status;
        const description = issue.status === 'archived'
          ? `Knowledge DB는 변경하지 않았습니다.${sessionOnly}`
          : `Knowledge DB에 저장된 사례는 없었습니다.${sessionOnly}`;
        toast.success(`${statusLabel} 이슈를 목록에서 삭제했습니다.`, { description });
      }
    } catch (error) {
      setIssues(previousIssues);
      setSelectedIssueId(selectedIssueId);
      toast.error('이슈 목록 삭제 저장에 실패했습니다.', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedIssue?.messages.length, isAiTyping]);

  // ─── Panel resize ──────────────────────────────────────────────
  const startResize = (e: React.MouseEvent) => {
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = rightPanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startXRef.current - ev.clientX;
      setRightPanelWidth(Math.max(360, Math.min(720, startWRef.current + delta)));
    };
    const onUp = () => { resizingRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const jumpToMessage = (messageId: string) => {
    const target = messageRefs.current[messageId];
    if (!target) {
      toast.info('연결된 채팅 메시지를 찾을 수 없습니다.');
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.animate(
      [{ outlineColor: 'rgba(96,165,250,0)' }, { outlineColor: 'rgba(96,165,250,0.9)' }, { outlineColor: 'rgba(96,165,250,0)' }],
      { duration: 1200 }
    );
  };

  const jumpToEvent = (event: IssueEvent) => {
    if (event.kind === 'message' && event.messageId) {
      jumpToMessage(event.messageId);
      return;
    }
    if (event.kind === 'panel') {
      setActivePanel(event.panel);
      toast.info(`${event.title} 위치로 이동했습니다.`);
    }
  };

  const addFilesAsAttachments = (files: FileList | File[]) => {
    const next = Array.from(files).map(file => ({
      id: `att-${Date.now()}-${file.name}`,
      type: file.type.startsWith('image/') ? 'image' as const : 'file' as const,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
    }));
    setPendingAttachments(prev => [...prev, ...next]);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      addFilesAsAttachments(files);
      e.preventDefault();
      return;
    }
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const urlMatch = text.trim().match(/^https?:\/\/\S+$/);
    if (urlMatch) {
      setPendingAttachments(prev => [...prev, { id: `url-${Date.now()}`, type: 'url', name: text.trim(), url: text.trim() }]);
      e.preventDefault();
      return;
    }
    if (text.includes('\t') || text.split('\n').some(line => line.includes(','))) {
      const rows = text.trim().split(/\r?\n/).map(row => row.includes('\t') ? row.split('\t') : row.split(','));
      if (rows.length >= 2 && rows[0].length >= 2) {
        setPendingAttachments(prev => [...prev, { id: `table-${Date.now()}`, type: 'table', name: '붙여넣은 표', rows }]);
        e.preventDefault();
      }
    }
  };

  // ─── Chat handlers ─────────────────────────────────────────────
  const handleSend = () => {
    if (!selectedIssue) return;
    const issueId = selectedIssue.id;
    const content = quotedText
      ? `> 인용 (${quotedText.source}): "${quotedText.text}"\n\n${inputValue}`
      : inputValue;
    if (!content.trim() && !quotedText && pendingAttachments.length === 0) return;
    const attachmentContext = pendingAttachments.map(attachEvidenceTrace);
    const useRfLocalFallback = isRfAnalysisIntent(content, attachmentContext);
    const analysis = useRfLocalFallback
      ? generateLocalRfReply({
          text: content,
          existingSignatures: selectedIssue.signatures,
          quotedSource: quotedText?.source,
          attachments: attachmentContext,
          signatureWeightRules,
          knowledgeCases,
          signatureAliasDictionary,
        })
      : { content: "", extractedTags: [] as SignatureTag[], source: 'fallback' as AnalysisSource, evidencePacket: undefined };
    const localHypotheses = analysis.evidencePacket ? buildLocalHybridHypotheses(analysis.evidencePacket) : [];
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      type: 'user',
      userId: currentUser.id,
      content: content.trim() || (pendingAttachments.length > 0 ? '첨부 자료를 추가했습니다.' : `> 인용 (${quotedText?.source}): "${quotedText?.text}"`),
      attachments: attachmentContext,
      pendingAliasCandidates: analysis.evidencePacket?.pendingAliasCandidates,
      replyTo: replyingTo ? { id: replyingTo.id, userId: replyingTo.userId, content: replyingTo.content.slice(0, 160), timestamp: replyingTo.timestamp } : undefined,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };
    const localSummary = analysis.evidencePacket
      ? buildLocalHybridSummary({
          packet: analysis.evidencePacket,
          messageId: newMsg.id,
          previousSummary: selectedIssue.chatSummary,
          timestamp: newMsg.timestamp,
        })
      : undefined;
    setIssues(prev => prev.map(iss =>
      iss.id === selectedIssueId
        ? {
            ...iss,
            messages: [...iss.messages, newMsg],
            signatures: useRfLocalFallback ? mergeSignatures(iss.signatures, analysis.extractedTags, signatureAliasDictionary) : iss.signatures,
            hypotheses: localHypotheses.length > 0 ? localHypotheses : iss.hypotheses,
            chatSummary: localSummary ?? iss.chatSummary,
          }
        : iss
    ));
    setInputValue('');
    setPendingAttachments([]);
    setReplyingTo(null);
    setQuotedText(null);
    setIsAiTyping(true);
    void (async () => {
      let llmAnalysis = { ...analysis, source: 'fallback' as AnalysisSource };
      let provider: Message['provider'] | undefined;
      let fallbackReason: string | undefined;
      try {
        const response = await runRfFipLlm('chat-reply', {
          text: content,
          signatures: selectedIssue.signatures,
          context: {
            issueId,
            title: selectedIssue.title,
            model: selectedIssue.model,
            band: selectedIssue.band,
            quotedSource: quotedText?.source,
            sharedAnalysisContext: buildSharedAnalysisContext(selectedIssue, signatureWeightRules, knowledgeCases, signatureAliasDictionary),
            localEvidencePacket: analysis.evidencePacket,
          },
          materials: attachmentContext.map(att => ({
            type: att.type,
            name: att.name,
            rows: att.rows,
          })),
        });
        provider = response.provider === 'gauss' ? 'gauss' : response.provider;
        if (!useRfLocalFallback && response.provider === 'local') {
          fallbackReason = 'provider=local';
          llmAnalysis = {
            content: "LLM provider가 local로 동작 중입니다. 일반 질문은 local RF 분석으로 대체하지 않았습니다.",
            extractedTags: [],
            source: 'fallback',
            evidencePacket: undefined,
          };
        } else {
          llmAnalysis = {
            ...buildLlmChatAnalysis(response.result, analysis),
            source: response.provider === 'local' ? 'local-rule' : 'llm',
            evidencePacket: analysis.evidencePacket,
          };
        }
      } catch (error) {
        console.info('RF-FIP LLM API unavailable; using local deterministic analysis.', error);
        fallbackReason = error instanceof RfFipApiError ? `status=${error.status}` : 'unavailable';
        llmAnalysis = {
          ...analysis,
          source: useRfLocalFallback ? 'local-rule' : 'fallback',
          content: buildLlmFallbackNotice(error, useRfLocalFallback ? analysis.content : undefined),
        };
        provider = 'local';
      }

      setIsAiTyping(false);
      const aiReply: Message = {
        id: `m-ai-${Date.now()}`,
        type: 'ai',
        content: llmAnalysis.content,
        extractedTags: llmAnalysis.extractedTags,
        provider,
        source: llmAnalysis.source,
        fallbackReason,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setIssues(prev => prev.map(iss =>
        iss.id === issueId
          ? {
              ...iss,
              messages: [...iss.messages, aiReply],
              signatures: mergeSignatures(iss.signatures, llmAnalysis.extractedTags, signatureAliasDictionary),
            }
          : iss
      ));
    })();
  };

  const handleApprove = async () => {
    if (!selectedIssue) return;
    try {
      await persistKnowledgeCase(buildKnowledgeCaseFromIssue(selectedIssue));
      setIssues(prev => prev.map(iss => iss.id === selectedIssueId ? { ...iss, status: 'confirmed' } : iss));
      setShowConfirmModal(false);
      toast.success('Knowledge DB registration approved.', { description: `${selectedIssue.id} saved to persistent API` });
    } catch (error) {
      toast.error('Knowledge DB 저장 API 호출에 실패했습니다.', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleReject = (reason: string) => {
    setShowConfirmModal(false);
    toast.error('반려 처리되었습니다.', { description: reason || '사유 없음' });
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Top Nav ── */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border/60 flex-shrink-0"
        style={{ background: 'var(--sidebar)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--rf-blue-bg)', border: '1px solid var(--rf-blue-border)' }}>
              <Radio className="w-4 h-4" style={{ color: 'var(--rf-blue-fg)' }} />
            </div>
            <span className="font-mono font-bold text-sm text-foreground">RF·FIP</span>
          </div>
          <span className="text-border">|</span>
          <nav className="flex items-center gap-1">
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                activeView === 'issues' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              onClick={() => setActiveView('issues')}
            >
              <Activity className="w-3.5 h-3.5" />
              이슈
            </button>
            <button
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                activeView === 'knowledge' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              onClick={() => { setKnowledgeSignatureFilter(null); setActiveView('knowledge'); }}
            >
              <Database className="w-3.5 h-3.5" />
              Knowledge DB
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />

          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent transition-colors"
              onClick={openUserEditor}
              title="현재 사용자 변경"
            >
              <UserAvatar user={currentUser} size="sm" />
              <span className="text-xs text-muted-foreground">{currentUser.name}</span>
            </button>
            {isEditingUser && (
              <div className="absolute right-0 top-9 z-50 w-64 rounded-lg border border-border/70 p-3 shadow-lg" style={{ background: 'var(--card)' }}>
                <p className="mb-2 text-[10px] font-semibold text-muted-foreground">현재 사용자 변경</p>
                <input
                  value={userNameInput}
                  onChange={event => setUserNameInput(event.target.value)}
                  placeholder="사용자 이름"
                  className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
                <input
                  value={userInitialsInput}
                  onChange={event => setUserInitialsInput(event.target.value)}
                  placeholder="이니셜 선택 입력"
                  className="mb-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsEditingUser(false)} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                    취소
                  </button>
                  <button type="button" onClick={applyCurrentUser} className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                    적용
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden items-center gap-2 px-2 py-1 rounded-lg hover:bg-accent transition-colors cursor-pointer"
            onClick={() => toast.info('단독 분석 모드입니다.')}>
            <UserAvatar user={currentUser} size="sm" />
            <span className="text-xs text-muted-foreground">단독 분석자</span>
          </div>
        </div>
      </header>

      {activeView === 'knowledge' ? (
        <KnowledgeDbWorkspace
          signatureFilter={knowledgeSignatureFilter}
          knowledgeCases={knowledgeCases}
          customSignatures={customDictionarySignatures}
          signatureAliasDictionary={signatureAliasDictionary}
          signatureWeightRules={signatureWeightRules}
          onChangeSignatureWeightRules={updateSignatureWeightRules}
          onChangeCustomSignatures={updateCustomDictionarySignatures}
          onFilterKnowledge={setKnowledgeSignatureFilter}
          onAddCase={persistKnowledgeCase}
          importHistory={importHistory}
          onImportHistoryChange={setImportHistory}
        />
      ) : (
        <>

      {/* ── Main 3-Panel Layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Panel – Issue List */}
        <aside className="w-72 flex-shrink-0 border-r border-border/60 flex flex-col overflow-hidden"
          style={{ background: 'var(--sidebar)' }}>
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">이슈 목록</span>
            <button className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => setShowCreateIssueModal(true)}
              aria-label="Create issue">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {issues.map(issue => (
              <div key={issue.id}
                className={cn("group relative rounded-lg border transition-all duration-150",
                  selectedIssueId === issue.id ? "bg-primary/10 border-primary/20" : "border-transparent hover:bg-accent"
                )}>
                <button onClick={() => setSelectedIssueId(issue.id)} className="w-full rounded-lg p-2.5 pr-8 text-left">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">{issue.id}</span>
                    <StatusBadge status={issue.status} />
                  </div>
                  <p className="text-xs font-medium text-foreground/90 leading-snug mb-1.5 line-clamp-2">{issue.title}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="sig-tag text-[10px]">{issue.band}</span>
                    <span className="text-[10px] text-muted-foreground">{issue.model.split(' ')[1]}</span>
                  </div>
                </button>
                {canRemoveIssueFromList(issue) && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleRemoveIssueFromListWithRiskConfirm(issue);
                    }}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    aria-label={`${issue.id} 이슈 목록에서 삭제`}
                    title="이슈 목록에서 삭제"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {issues.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                표시할 이슈가 없습니다.
              </div>
            )}
          </div>
        </aside>

        {/* Center Panel — Chat */}
        {selectedIssue ? (
        <>
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Issue Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 flex-shrink-0"
            style={{ background: 'var(--card)' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground">{selectedIssue.id}</span>
                <StatusBadge status={selectedIssue.status} />
                <span className="sig-tag text-[10px]">{selectedIssue.band}</span>
              </div>
              <h1 className="text-sm font-semibold text-foreground truncate">{selectedIssue.title}</h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
              <div className="rounded-lg border border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
                단독 분석 모드
              </div>
              {selectedIssue.status !== 'confirmed' && selectedIssue.status !== 'archived' && (
                <button onClick={() => setShowRcaModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[0.98]"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', boxShadow: '0 0 16px var(--ring)' }}>
                  <Database className="w-3.5 h-3.5" />
                  RCA 요약 & DB 등록
                </button>
              )}
              {selectedIssue.status === 'confirmed' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--rf-green-bg)', color: 'var(--rf-green-fg)', border: '1px solid var(--rf-green-border)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> DB 등록 완료
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedIssue.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="w-10 h-10 mb-3" style={{ color: 'var(--rf-blue-fg)', opacity: 0.5 }} />
                <p className="text-sm text-muted-foreground">대화 내역이 없습니다.</p>
              </div>
            ) : (
              selectedIssue.messages.map(msg => (
                <div
                  key={msg.id}
                  ref={el => { messageRefs.current[msg.id] = el; }}
                  className="rounded-md outline outline-2 outline-transparent"
                >
                  <ChatMessage
                    msg={msg}
                    users={userDirectory}
                    onApproveAlias={approveAliasCandidate}
                    onReply={(target) => {
                      setReplyingTo(target);
                      setQuotedText({ text: target.content.slice(0, 160), source: target.type === 'ai' ? 'RF 분석 도우미' : '사용자 입력' });
                    }}
                  />
                </div>
              ))
            )}
            {isAiTyping && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-row-reverse gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--ai-bubble-bg)', border: '1px solid var(--ai-bubble-border)' }}>
                  <Bot className="w-4 h-4" style={{ color: 'var(--rf-blue-fg)' }} />
                </div>
                <div className="bubble-ai w-fit rounded-xl rounded-tr-sm px-4 py-3 flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--rf-blue-fg)' }}
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-border/60 flex-shrink-0" style={{ background: 'var(--card)' }}>
            {/* Quote preview */}
            <AnimatePresence>
              {quotedText && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-2"
                >
                  <div className="bubble-quote rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Quote className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-primary font-medium mb-0.5">{quotedText.source}</p>
                        <p className="text-xs text-foreground/70 truncate">{quotedText.text}</p>
                      </div>
                    </div>
                    <button onClick={() => setQuotedText(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {pendingAttachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingAttachments.map(att => (
                  <div key={att.id} className="flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[10px] text-foreground/75" style={{ background: 'var(--panel-surface)' }}>
                    {att.type === 'image' ? <ImageIcon className="h-3 w-3" /> : att.type === 'table' ? <Table2 className="h-3 w-3" /> : att.type === 'url' ? <ExternalLink className="h-3 w-3" /> : <Paperclip className="h-3 w-3" />}
                    <span className="max-w-36 truncate">{att.name}</span>
                    <button onClick={() => setPendingAttachments(prev => prev.filter(item => item.id !== att.id))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-xl border border-border/60 p-2"
              style={{ background: 'var(--panel-surface)' }}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.csv,.tsv,.txt,.xlsx,.xls"
                onChange={e => {
                  if (e.target.files) addFilesAsAttachments(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
              <button className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                className="flex-1 bg-transparent text-sm text-foreground/90 placeholder:text-muted-foreground/50 resize-none outline-none min-h-[36px] max-h-[120px] py-1"
                placeholder="측정 결과 또는 분석 내용을 입력하세요..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                rows={1}
              />
              <button onClick={handleSend}
                disabled={!inputValue.trim() && !quotedText && pendingAttachments.length === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:scale-105 active:scale-95 flex-shrink-0"
                style={{ background: (inputValue.trim() || quotedText || pendingAttachments.length > 0) ? 'oklch(0.56 0.22 260)' : 'var(--muted)' }}>
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1.5 px-1">
              <span className="text-[10px] text-muted-foreground/50">현재 사용자: 김민준 · 단독 분석 모드</span>
              <span className="text-[10px] text-muted-foreground/50">Enter로 전송 · Shift+Enter 줄바꿈</span>
              <span className="text-[10px] text-muted-foreground/50 ml-auto flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> 이미지
                <Table2 className="w-3 h-3 ml-1" /> 표
                <ExternalLink className="w-3 h-3 ml-1" /> URL 첨부 지원
              </span>
            </div>
          </div>
        </main>

        {/* Resize handle */}
        <div
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary/30 transition-colors"
          style={{ background: 'var(--border)' }}
          onMouseDown={startResize}
        />

        {/* Right Panel — resizable */}
        <aside
          className="flex-shrink-0 border-l border-border/60 flex flex-col overflow-hidden"
          style={{ width: rightPanelWidth, background: 'var(--sidebar)' }}
        >
          {/* Status Timeline */}
          <div className="p-3 border-b border-border/60">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">이슈 진행 상태</p>
            <StatusTimeline status={selectedIssue.status} />
            <div className="flex justify-between mt-1">
              {STATUS_STEPS.filter(s => s !== 'archived').map(s => (
                <span key={s} className="text-[9px] text-muted-foreground/60 capitalize">{STATUS_CONFIG[s].label}</span>
              ))}
            </div>
          </div>

          {/* Panel Tabs */}
          <div className="flex border-b border-border/60">
            {([
              { key: 'hypotheses', label: '가설', icon: Zap },
              { key: 'signatures', label: 'Sig.', icon: Tag },
              { key: 'similar', label: '유사', icon: Search },
              { key: 'summary', label: '요약', icon: FileText },
              { key: 'timeline', label: '이벤트', icon: Activity },
            ] as const).filter(item => item.key !== 'timeline').map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActivePanel(key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors border-b-2",
                  activePanel === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-3">
            <AnimatePresence mode="wait">
              {activePanel === 'hypotheses' && (
                <HypothesisDetailPanel
                  hypotheses={selectedIssue.hypotheses}
                />
              )}
              {activePanel === 'signatures' && (
                <SignaturePanel
                  signatures={selectedIssue.signatures}
                  issueStatus={selectedIssue.status}
                  onUpdate={(sigs) => setIssues(prev => prev.map(iss =>
                    iss.id === selectedIssueId ? { ...iss, signatures: sigs } : iss
                  ))}
                />
              )}
              {activePanel === 'similar' && (
                <motion.div key="similar" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <SimilarCasesPanel
                    signatures={selectedIssue.signatures}
                    knowledgeCases={knowledgeCases}
                    signatureAliasDictionary={signatureAliasDictionary}
                    signatureWeightRules={signatureWeightRules}
                  />
                </motion.div>
              )}
              {activePanel === 'summary' && (
                selectedIssue.chatSummary
                  ? (
                    <ChatSummaryPanel
                      summary={selectedIssue.chatSummary}
                      onJumpToMessage={jumpToMessage}
                      onQuoteToChat={(text, source) => {
                        setQuotedText({ text, source });
                        toast.success(`"${source}" 내용을 채팅 인용으로 추가했습니다.`);
                      }}
                    />
                  )
                  : (
                    <motion.div key="no-summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-center py-8 text-muted-foreground/40 text-xs">
                      <FileText className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      채팅 내용이 충분히 쌓이면 자동 요약됩니다
                    </motion.div>
                  )
              )}
              {activePanel === 'timeline' && (
                <motion.div key="timeline" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">분석 이벤트</p>
                  {buildIssueEvents(selectedIssue).map(event => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => jumpToEvent(event)}
                      className="w-full rounded-lg border border-border/60 p-2 text-left transition-colors hover:bg-accent"
                      style={{ background: 'var(--panel-surface)' }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-foreground/80">{event.title}</span>
                        <span className="text-[10px] text-muted-foreground/60">{event.time}</span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-foreground/75">{event.detail}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {event.kind === 'message' ? '채팅으로 이동' : `${event.panel} 탭으로 이동`}
                        </span>
                        {event.kind === 'message' && event.provider && (
                          <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {event.provider}
                          </span>
                        )}
                        <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                          {sourceLabel(event.source)}
                        </span>
                        {event.kind === 'message' && event.fallbackReason && (
                          <span className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {event.fallbackReason}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </aside>
        </>
        ) : (
          <main className="flex-1 overflow-hidden min-w-0">
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <FileText className="mb-3 h-8 w-8 opacity-40" />
              <p>선택할 이슈가 없습니다.</p>
              <button
                onClick={() => setShowCreateIssueModal(true)}
                className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
              >
                새 이슈 생성
              </button>
            </div>
          </main>
        )}
      </div>
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreateIssueModal && (
          <CreateIssueModal onClose={() => setShowCreateIssueModal(false)} onCreate={handleCreateIssue} />
        )}
        {showConfirmModal && selectedIssue && (
          <DBConfirmModal issue={selectedIssue} onClose={() => setShowConfirmModal(false)} onApprove={handleApprove} onReject={handleReject} />
        )}
        {showRcaModal && selectedIssue && (
          <RcaSummaryModal issue={selectedIssue} onClose={() => setShowRcaModal(false)} onSubmit={() => { setShowRcaModal(false); setShowConfirmModal(true); }} onApprove={handleApprove} />
        )}
      </AnimatePresence>
    </div>
  );
}
