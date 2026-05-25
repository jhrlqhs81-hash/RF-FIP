import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  HelpCircle,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ChatSummary, SummaryItem } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface SectionProps {
  icon: ReactNode;
  title: string;
  items: SummaryItem[];
  color: string;
  bgColor: string;
  borderColor: string;
  defaultOpen?: boolean;
  onJumpToMessage?: (messageId: string) => void;
}

function summaryText(item: SummaryItem): string {
  return typeof item === "string" ? item : item.text;
}

function summaryMessageId(item: SummaryItem): string | undefined {
  return typeof item === "string" ? undefined : item.messageId;
}

function summaryRationale(item: SummaryItem): string | undefined {
  return typeof item === "string" ? undefined : item.rationale;
}

function summaryEvidence(item: SummaryItem): string[] {
  return typeof item === "string" ? [] : item.evidence ?? [];
}

function SummarySection({
  icon,
  title,
  items,
  color,
  bgColor,
  borderColor,
  defaultOpen = true,
  onJumpToMessage,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold" style={{ color }}>{title}</span>
          <span className="font-mono text-[10px] text-muted-foreground/60">{items.length}</span>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-150", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5 border-t border-white/5">
              {items.map((item, i) => {
                const messageId = summaryMessageId(item);
                const clickable = !!messageId && !!onJumpToMessage;
                const rationale = summaryRationale(item);
                const evidence = summaryEvidence(item);
                return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "flex items-start gap-2 rounded-md pt-1.5",
                    clickable && "cursor-pointer hover:bg-white/5"
                  )}
                  onClick={() => messageId && onJumpToMessage?.(messageId)}
                  title={clickable ? "관련 채팅 위치로 이동" : undefined}
                >
                  <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] text-foreground/80 leading-relaxed">{summaryText(item)}</p>
                    {rationale && (
                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        근거: {rationale}
                      </p>
                    )}
                    {evidence.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {evidence.map((entry, idx) => (
                          <span key={idx} className="rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {entry}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ChatSummaryPanelProps {
  summary: ChatSummary;
  onJumpToMessage?: (messageId: string) => void;
}

export function ChatSummaryPanel({
  summary,
  onJumpToMessage,
}: ChatSummaryPanelProps) {
  return (
    <motion.div
      key="summary"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">분석 요약</p>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <Clock className="w-3 h-3" />
          {summary.lastUpdated}
        </div>
      </div>

      <SummarySection
        icon={<Lightbulb className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />}
        title="주요 발견"
        items={summary.keyFindings}
        color="#F59E0B"
        bgColor="oklch(0.19 0.03 55)"
        borderColor="oklch(0.28 0.06 55)"
        onJumpToMessage={onJumpToMessage}
      />

      <SummarySection
        icon={<CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#10B981" }} />}
        title="확인된 사실"
        items={summary.confirmedFacts}
        color="#10B981"
        bgColor="oklch(0.18 0.03 150)"
        borderColor="oklch(0.27 0.06 150)"
        onJumpToMessage={onJumpToMessage}
      />

      <SummarySection
        icon={<HelpCircle className="w-3.5 h-3.5" style={{ color: "#F43F5E" }} />}
        title="미해결 질문"
        items={summary.pendingQuestions}
        color="#F43F5E"
        bgColor="oklch(0.18 0.04 25)"
        borderColor="oklch(0.27 0.07 25)"
      />

      <SummarySection
        icon={<ArrowRight className="w-3.5 h-3.5" style={{ color: "#60A5FA" }} />}
        title="다음 분석 단계"
        items={summary.nextSteps}
        color="#60A5FA"
        bgColor="oklch(0.18 0.03 260)"
        borderColor="oklch(0.27 0.06 260)"
      />

      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 pt-1">
        <RefreshCw className="w-3 h-3" />
        채팅 내용 기반 자동 업데이트
      </div>
    </motion.div>
  );
}
