"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type {
  MathExpression,
  MathItem,
  MathResult,
  MathStep,
} from "@repo/math/schema";
import { useTranslations } from "next-intl";
import { Expression } from "@/components/ai/message-part/math/expression";
import { getItemLabelKey } from "@/components/ai/message-part/math/labels";

interface MathEvidenceProps {
  message: DataPart["math"];
}

interface StepListProps {
  steps: readonly MathStep[];
}

interface StepRowProps {
  number: number;
  step: MathStep;
}

interface ResultLineProps {
  result: MathResult;
}

interface ItemListProps {
  items: readonly MathItem[];
}

interface ItemRowProps {
  item: MathItem;
}

interface ConditionListProps {
  conditions: readonly MathExpression[];
}

/** Renders deterministic math evidence without extra card chrome. */
export function MathEvidence({ message }: MathEvidenceProps) {
  const t = useTranslations("Ai");

  if (message.status === "loading") {
    return <p>{t("math-loading")}</p>;
  }

  if (message.status === "error") {
    return <p className="text-muted-foreground">{t("math-error")}</p>;
  }

  return (
    <div className="flex max-w-full flex-col gap-2">
      <StepList steps={message.result.steps} />
      {message.result.steps.length === 0 ? (
        <ResultLine result={message.result} />
      ) : null}
      <ItemList items={message.result.items} />
      <ConditionList conditions={message.result.conditions} />
    </div>
  );
}

/** Renders deterministic math steps before the final result. */
function StepList({ steps }: StepListProps) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-col gap-2">
      {steps.map((step, index) => (
        <StepRow
          key={`${step.action}-${step.primary.expression}-${step.relation?.expression ?? ""}-${step.secondary?.expression ?? ""}`}
          number={index + 1}
          step={step}
        />
      ))}
    </div>
  );
}

/** Renders one derivation step using the relation supplied by math evidence. */
function StepRow({ number, step }: StepRowProps) {
  const t = useTranslations("Ai");

  return (
    <div className="grid max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
      <span className="flex shrink-0 items-center gap-2 text-muted-foreground/80">
        <span>{t("math-step", { number })}</span>
        <HugeIcons className="size-3.5 shrink-0" icon={ArrowRight02Icon} />
      </span>
      <span className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto overflow-y-hidden">
        <Expression value={step.primary.latex} />
        {step.relation ? <Expression value={step.relation.latex} /> : null}
        {step.secondary ? <Expression value={step.secondary.latex} /> : null}
      </span>
    </div>
  );
}

/** Renders the main math result in a sentence-like shape students can scan. */
function ResultLine({ result }: ResultLineProps) {
  if (!result.secondary) {
    return <Expression value={result.primary.latex} />;
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto overflow-y-hidden">
      <Expression value={result.primary.latex} />
      <Relation result={result} />
      <Expression value={result.secondary.latex} />
    </div>
  );
}

/** Uses words for operations where `=` would be ambiguous. */
function Relation({ result }: ResultLineProps) {
  const t = useTranslations("Ai");

  if (result.operation === "compare") {
    return <span>{t(`math-compare-${result.status}`)}</span>;
  }

  if (result.operation === "differentiate") {
    return <span>{t("math-relation-differentiate")}</span>;
  }

  if (result.operation === "limit") {
    return <span>{t("math-relation-limit")}</span>;
  }

  if (result.operation === "roots" || result.operation === "solve") {
    return <span>{t("math-relation-solve")}</span>;
  }

  return <InlineMath>=</InlineMath>;
}

/** Renders extra math rows, such as roots, modes, or eigenvalues. */
function ItemList({ items }: ItemListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-col gap-2">
      {items.map((item) => (
        <ItemRow item={item} key={`${item.label}-${item.value}`} />
      ))}
    </div>
  );
}

/** Renders one supporting math item with a localized student-facing label. */
function ItemRow({ item }: ItemRowProps) {
  const t = useTranslations("Ai");

  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto overflow-y-hidden">
      <span className="shrink-0">{t(getItemLabelKey(item.label))}</span>
      {item.latex ? (
        <Expression value={item.latex} />
      ) : (
        <span>{item.value}</span>
      )}
    </div>
  );
}

/** Renders domain restrictions and other required math conditions. */
function ConditionList({ conditions }: ConditionListProps) {
  const t = useTranslations("Ai");

  if (conditions.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 overflow-x-auto overflow-y-hidden">
      <span>{t("math-condition")}</span>
      {conditions.map((condition) => (
        <Expression key={condition.expression} value={condition.latex} />
      ))}
    </div>
  );
}
