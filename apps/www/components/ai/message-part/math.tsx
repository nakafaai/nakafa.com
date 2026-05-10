"use client";

import {
  AbacusIcon,
  ApproximatelyEqualIcon,
  ArrowDown01Icon,
  CalculateIcon,
  ChartAverageIcon,
  DiceIcon,
  DrawingCompassIcon,
  FunctionIcon,
  MatrixIcon,
  NThRootIcon,
  SummationCircleIcon,
} from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import type { DataPart } from "@repo/ai/schema/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import type { MathItem, MathOperation, MathResult } from "@repo/math/schema";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  message: DataPart["math"];
}

/** Renders one deterministic math evidence part in the chat transcript. */
export const MathPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, { set }] = useDisclosure(message.status === "loading");

  return (
    <Collapsible
      className="not-prose flex max-w-full flex-col gap-2"
      onOpenChange={set}
      open={expanded}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <HugeIcons className="size-4 shrink-0" icon={getIcon(message.kind)} />
        <span className="truncate">{t(`math-${message.kind}`)}</span>
        <HugeIcons
          className={cn(
            "size-4 shrink-0 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full overflow-hidden text-muted-foreground text-sm outline-none">
        <MathEvidence message={message} />
      </CollapsibleContent>
    </Collapsible>
  );
});
MathPart.displayName = "MathPart";

/** Renders deterministic CAS evidence without extra card chrome. */
function MathEvidence({ message }: Props) {
  const t = useTranslations("Ai");

  if (message.status === "loading") {
    return <p>{t("math-loading")}</p>;
  }

  if (message.status === "error") {
    return <p className="text-destructive">{message.error}</p>;
  }

  return (
    <div className="flex max-w-full flex-col gap-2">
      <ResultLine result={message.result} />
      <ItemList items={message.result.items} />
      <ConditionList conditions={message.result.conditions} />
    </div>
  );
}

/** Renders the main CAS result in a sentence-like shape students can scan. */
function ResultLine({ result }: { result: MathResult }) {
  if (!result.secondary) {
    return <Expression value={result.primary.latex} />;
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
      <Expression value={result.primary.latex} />
      <Relation result={result} />
      <Expression value={result.secondary.latex} />
    </div>
  );
}

/** Uses words for operations where `=` would be ambiguous. */
function Relation({ result }: { result: MathResult }) {
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

/** Keeps rendered math in the same muted tone as the surrounding evidence. */
function Expression({ value }: { value: string }) {
  return (
    <span className="max-w-full overflow-x-auto text-muted-foreground [&_.katex]:text-muted-foreground">
      <InlineMath>{value}</InlineMath>
    </span>
  );
}

/** Renders extra CAS rows, such as roots, modes, or eigenvalues. */
function ItemList({ items }: { items: readonly MathItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-col gap-1">
      {items.map((item) => (
        <ItemRow item={item} key={`${item.label}-${item.value}`} />
      ))}
    </div>
  );
}

/** Renders one supporting CAS item with a localized student-facing label. */
function ItemRow({ item }: { item: MathItem }) {
  const t = useTranslations("Ai");

  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
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
function ConditionList({ conditions }: { conditions: readonly string[] }) {
  const t = useTranslations("Ai");

  if (conditions.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
      <span>{t("math-condition")}</span>
      {conditions.map((condition) => (
        <span
          className="max-w-full overflow-x-auto text-muted-foreground"
          key={condition}
        >
          {condition}
        </span>
      ))}
    </div>
  );
}

/** Maps CAS item labels to stable translation keys. */
function getItemLabelKey(label: string) {
  switch (label) {
    case "counterexample":
      return "math-item-counterexample";
    case "domain":
      return "math-item-domain";
    case "eigenvalue":
      return "math-item-eigenvalue";
    case "eigenvector":
      return "math-item-eigenvector";
    case "factor":
      return "math-item-factor";
    case "mode":
      return "math-item-mode";
    case "q1":
      return "math-item-q1";
    case "q2":
      return "math-item-q2";
    case "q3":
      return "math-item-q3";
    case "root":
      return "math-item-root";
    case "solution":
      return "math-item-solution";
    default:
      return "math-item-result";
  }
}

/** Selects the math-specific icon for each CAS operation group. */
function getIcon(operation: MathOperation) {
  switch (operation) {
    case "evaluate":
      return CalculateIcon;
    case "apart":
    case "cancel":
    case "domain":
    case "expand":
    case "factor":
    case "rationalize":
    case "simplify":
    case "together":
      return ApproximatelyEqualIcon;
    case "compare":
      return AbacusIcon;
    case "roots":
    case "solve":
      return NThRootIcon;
    case "differentiate":
    case "integrate":
    case "limit":
      return FunctionIcon;
    case "product":
    case "series":
    case "summation":
      return SummationCircleIcon;
    case "determinant":
    case "eigenvalues":
    case "eigenvectors":
    case "inverse":
    case "linear_system":
    case "matrix_multiply":
    case "rank":
    case "rref":
      return MatrixIcon;
    case "mean":
    case "median":
    case "mode":
    case "quartiles":
    case "standard_deviation":
    case "variance":
    case "z_score":
      return ChartAverageIcon;
    case "distribution":
    case "expected_value":
    case "variance_probability":
      return DiceIcon;
    case "circle":
    case "distance":
    case "intersection":
    case "line":
    case "midpoint":
    case "slope":
      return DrawingCompassIcon;
    case "combination":
    case "gcd":
    case "is_prime":
    case "lcm":
    case "modular":
    case "permutation":
    case "prime_factorization":
      return AbacusIcon;
    default:
      return AbacusIcon;
  }
}
