import type { DataPart } from "@repo/backend/confect/nina/contract/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { MathResult } from "@repo/math/schema/result";
import type {
  MathExpression,
  MathItem,
  MathStep,
} from "@repo/math/schema/shared";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { Expression } from "@/components/ai/message/evidence/math/expression";
import {
  getItemLabelKey,
  getItemValueKey,
} from "@/components/ai/message/evidence/math/labels";
import { Row } from "@/components/ai/message/evidence/math/row";
import { Rows } from "@/components/ai/message/evidence/rows";

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

interface ItemValueProps {
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
    return <p className="text-destructive">{t("math-error")}</p>;
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
      <Rows>
        {Arr.map(steps, (step, index) => (
          <StepRow
            key={`${step.action}-${step.primary.expression}-${step.relation?.expression ?? ""}-${step.secondary?.expression ?? ""}`}
            number={index + 1}
            step={step}
          />
        ))}
      </Rows>
    </div>
  );
}

/** Renders one derivation step using the relation supplied by math evidence. */
function StepRow({ number, step }: StepRowProps) {
  const t = useTranslations("Ai");

  return (
    <Row label={t("math-step", { number })}>
      <Expression value={step.primary.latex} />
      {step.relation ? <Expression value={step.relation.latex} /> : null}
      {step.secondary ? <Expression value={step.secondary.latex} /> : null}
    </Row>
  );
}

/** Renders the main math result in a sentence-like shape students can scan. */
function ResultLine({ result }: ResultLineProps) {
  const t = useTranslations("Ai");
  const label = result.secondary ? t("math-item-result") : t("math-input");

  return (
    <Row label={label}>
      <Expression value={result.primary.latex} />
      {result.secondary ? <Relation result={result} /> : null}
      {result.secondary ? <Expression value={result.secondary.latex} /> : null}
    </Row>
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
      <Rows>
        {Arr.map(items, (item) => (
          <ItemRow item={item} key={`${item.label}-${item.value}`} />
        ))}
      </Rows>
    </div>
  );
}

/** Renders one supporting math item with a localized student-facing label. */
function ItemRow({ item }: ItemRowProps) {
  const t = useTranslations("Ai");

  return (
    <Row label={t(getItemLabelKey(item.label))}>
      <ItemValue item={item} />
    </Row>
  );
}

/** Renders one supporting item value with semantic booleans localized for users. */
function ItemValue({ item }: ItemValueProps) {
  const t = useTranslations("Ai");
  const valueKey = getItemValueKey(item.label, item.value);

  if (valueKey) {
    return <span>{t(valueKey)}</span>;
  }

  if (item.latex) {
    return <Expression value={item.latex} />;
  }

  return <span>{item.value}</span>;
}

/**
 * Renders domain restrictions and other required math conditions on one row.
 * The CAS limits the size of a whole result, not how many conditions it holds,
 * so the first five show and the rest sit behind the button that steps and
 * items use.
 */
function ConditionList({ conditions }: ConditionListProps) {
  const t = useTranslations("Ai");

  if (conditions.length === 0) {
    return null;
  }

  return (
    <Row label={t("math-condition")}>
      <Rows>
        {Arr.map(conditions, (condition) => (
          <Expression key={condition.expression} value={condition.latex} />
        ))}
      </Rows>
    </Row>
  );
}
