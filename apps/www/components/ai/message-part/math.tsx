"use client";

import {
  AbacusIcon,
  ApproximatelyEqualIcon,
  ArrangeByNumbersOneNineIcon,
  ArrowDataTransferDiagonalIcon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  ArrowExpand02Icon,
  CalculateIcon,
  CancelCircleIcon,
  ChartAverageIcon,
  ChartBarLineIcon,
  ChartEvaluationIcon,
  ChartHistogramIcon,
  ChartLineData01Icon,
  ChartMaximumIcon,
  ChartMediumIcon,
  CircleIcon,
  CongruentToCircleIcon,
  Coordinate01Icon,
  DiceFacesIcon,
  DiceIcon,
  DistributionIcon,
  DivideSignCircleIcon,
  FunctionCircleIcon,
  FunctionOfXIcon,
  FunctionSquareIcon,
  GridTableIcon,
  GroupIcon,
  GroupItemsIcon,
  HierarchySquare03Icon,
  Infinity01Icon,
  LineIcon,
  MatrixIcon,
  MultiplicationSignCircleIcon,
  MultiplicationSignSquareIcon,
  NThRootIcon,
  PathfinderIntersectIcon,
  PiCircleIcon,
  PiIcon,
  PlusMinusCircle01Icon,
  RankingIcon,
  RootCircleIcon,
  RulerIcon,
  SecondBracketIcon,
  SquareRootSquareIcon,
  Summation01Icon,
  SummationCircleIcon,
  TextNumberSignIcon,
  TriangleIcon,
  UngroupItemsIcon,
  XVariableSquareIcon,
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
import type {
  MathExpression,
  MathItem,
  MathOperation,
  MathResult,
  MathStep,
} from "@repo/math/schema";
import { useTranslations } from "next-intl";
import { memo } from "react";

interface Props {
  message: DataPart["math"];
}

/** Renders one deterministic math evidence part in the chat transcript. */
export const MathPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, { set }] = useDisclosure(false);

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
      <StepList steps={message.result.steps} />
      <ResultLine result={message.result} />
      <ItemList items={message.result.items} />
      <ConditionList conditions={message.result.conditions} />
    </div>
  );
}

/** Renders deterministic CAS steps before the final result. */
function StepList({ steps }: { steps: readonly MathStep[] }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-col gap-1">
      {steps.map((step) => (
        <StepRow
          key={`${step.action}-${step.primary.expression}-${step.relation?.expression ?? ""}-${step.secondary?.expression ?? ""}`}
          step={step}
        />
      ))}
    </div>
  );
}

/** Renders one CAS derivation step using the relation supplied by CAS. */
function StepRow({ step }: { step: MathStep }) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
      <Expression value={step.primary.latex} />
      {step.relation ? <Expression value={step.relation.latex} /> : null}
      {step.secondary ? <Expression value={step.secondary.latex} /> : null}
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
function ConditionList({
  conditions,
}: {
  conditions: readonly MathExpression[];
}) {
  const t = useTranslations("Ai");

  if (conditions.length === 0) {
    return null;
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1">
      <span>{t("math-condition")}</span>
      {conditions.map((condition) => (
        <Expression key={condition.expression} value={condition.latex} />
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
    case "simplify":
      return ApproximatelyEqualIcon;
    case "factor":
      return SecondBracketIcon;
    case "expand":
      return ArrowExpand02Icon;
    case "cancel":
      return CancelCircleIcon;
    case "together":
      return GroupItemsIcon;
    case "apart":
      return UngroupItemsIcon;
    case "rationalize":
      return SquareRootSquareIcon;
    case "domain":
      return XVariableSquareIcon;
    case "compare":
      return CongruentToCircleIcon;
    case "solve":
      return RootCircleIcon;
    case "roots":
      return NThRootIcon;
    case "differentiate":
      return FunctionOfXIcon;
    case "integrate":
      return FunctionCircleIcon;
    case "limit":
      return Infinity01Icon;
    case "series":
      return SummationCircleIcon;
    case "summation":
      return Summation01Icon;
    case "product":
      return MultiplicationSignCircleIcon;
    case "determinant":
      return MatrixIcon;
    case "inverse":
      return ArrowDataTransferHorizontalIcon;
    case "rank":
      return RankingIcon;
    case "rref":
      return GridTableIcon;
    case "eigenvalues":
      return FunctionSquareIcon;
    case "eigenvectors":
      return ArrowDataTransferDiagonalIcon;
    case "linear_system":
      return HierarchySquare03Icon;
    case "matrix_multiply":
      return MultiplicationSignSquareIcon;
    case "mean":
      return ChartAverageIcon;
    case "median":
      return ChartMediumIcon;
    case "mode":
      return ChartMaximumIcon;
    case "quartiles":
      return ChartHistogramIcon;
    case "standard_deviation":
      return ChartLineData01Icon;
    case "variance":
      return ChartBarLineIcon;
    case "z_score":
      return ChartEvaluationIcon;
    case "distribution":
      return DistributionIcon;
    case "expected_value":
      return DiceIcon;
    case "variance_probability":
      return DiceFacesIcon;
    case "circle":
      return CircleIcon;
    case "distance":
      return RulerIcon;
    case "intersection":
      return PathfinderIntersectIcon;
    case "line":
      return LineIcon;
    case "midpoint":
      return Coordinate01Icon;
    case "slope":
      return TriangleIcon;
    case "combination":
      return GroupIcon;
    case "permutation":
      return ArrangeByNumbersOneNineIcon;
    case "gcd":
      return AbacusIcon;
    case "lcm":
      return PlusMinusCircle01Icon;
    case "is_prime":
      return PiIcon;
    case "modular":
      return DivideSignCircleIcon;
    case "prime_factorization":
      return TextNumberSignIcon;
    default:
      return PiCircleIcon;
  }
}
