import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SignatureTag } from "@/lib/mockData";
import { describeSignatureConcept } from "@/lib/signatureConceptRegistry";
import { cn } from "@/lib/utils";

export type SignatureMappingStatus = {
  label: string;
  tone: "mapped" | "partial" | "unmapped";
  description: string;
  detail?: string;
  domain?: string;
  conceptId?: string;
  valueId?: string;
  path?: string;
  engineUse: string[];
};

export function getSignatureMappingStatus(tag: SignatureTag): SignatureMappingStatus {
  const concept = describeSignatureConcept(tag);
  if (!concept) {
    return {
      label: "미매핑",
      tone: "unmapped",
      description: "표시/필터용으로 저장되며 분석, 유사사례, 누락 체크리스트 영향은 제한됩니다.",
      engineUse: ["표시", "필터"],
    };
  }

  if ("valueId" in concept && concept.valueId) {
    return {
      label: "엔진 매핑됨",
      tone: "mapped",
      description: "Local Engine 계층 signature로 해석됩니다.",
      detail: `${concept.path} → ${concept.valueId}`,
      domain: concept.domain,
      conceptId: concept.conceptId,
      valueId: concept.valueId,
      path: concept.path,
      engineUse: ["분석", "유사사례 검색", "누락 체크리스트", "LLM context"],
    };
  }

  return {
    label: "Key만 매핑",
    tone: "partial",
    description: "Key는 계층에 연결됐지만 value는 아직 canonical value/alias로 확인되지 않았습니다.",
    detail: concept.path,
    domain: concept.domain,
    conceptId: concept.conceptId,
    path: concept.path,
    engineUse: ["Key 기반 검색", "부분 분석"],
  };
}

export function SignatureMappingBadge({ tag, className }: { tag: SignatureTag; className?: string }) {
  const status = getSignatureMappingStatus(tag);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        status.tone === "mapped" && "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300",
        status.tone === "partial" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        status.tone === "unmapped" && "border-border/60 bg-muted/40 text-muted-foreground",
        className
      )}
      title={status.description}
    >
      {status.label}
    </span>
  );
}

export function SignatureMappingDetail({ tag, className }: { tag: SignatureTag; className?: string }) {
  const status = getSignatureMappingStatus(tag);
  return (
    <div className={cn("rounded-md border border-border/60 bg-muted/30 p-2 text-[10px] text-muted-foreground", className)}>
      <p className="leading-snug">{status.description}</p>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <MappingField label="Domain" value={status.domain ?? "-"} />
        <MappingField label="Concept" value={status.conceptId ?? "-"} />
        <MappingField label="Value" value={status.valueId ?? "-"} />
        <MappingField label="Path" value={status.path ?? status.detail ?? "-"} />
      </div>
      <p className="mt-2 leading-snug">
        반영 범위: {status.engineUse.join(", ")}
      </p>
    </div>
  );
}

export function SignatureMappingInspector({ tag, className }: { tag: SignatureTag; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <SignatureMappingBadge tag={tag} />
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          계층 보기
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && <SignatureMappingDetail tag={tag} />}
    </div>
  );
}

function MappingField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="mr-1 text-muted-foreground/70">{label}</span>
      <span className="font-mono text-foreground/80">{value}</span>
    </div>
  );
}
