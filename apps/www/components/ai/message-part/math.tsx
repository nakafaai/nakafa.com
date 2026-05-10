"use client";

import {
  ApproximatelyEqualIcon,
  ArrowDown01Icon,
  CalculateIcon,
  CongruentToIcon,
  FunctionOfXIcon,
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
import { useTranslations } from "next-intl";
import { memo, type ReactNode } from "react";

interface Props {
  message: DataPart["math"];
}

export const MathPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");
  const [expanded, { set }] = useDisclosure(
    message.status === "loading" || message.status === "error"
  );

  return (
    <Collapsible
      className="flex max-w-full flex-col gap-2"
      onOpenChange={set}
      open={expanded}
    >
      <CollapsibleTrigger className="flex w-fit max-w-full cursor-pointer items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <HugeIcons className="size-4 shrink-0" icon={getIcon(message)} />
        <span className="truncate">{getTitle(t, message)}</span>
        <HugeIcons
          className={cn(
            "size-4 shrink-0 transition-transform",
            expanded ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full overflow-hidden text-muted-foreground text-sm">
        <MathEvidence message={message} />
      </CollapsibleContent>
    </Collapsible>
  );
});
MathPart.displayName = "MathPart";

/** Renders the evidence body for one deterministic math result. */
function MathEvidence({ message }: Props) {
  const t = useTranslations("Ai");

  if (message.status === "loading") {
    return <p className="text-muted-foreground">{t("math-loading")}</p>;
  }

  if (message.status === "error") {
    return <p className="text-destructive text-sm">{message.error}</p>;
  }

  if (message.kind === "compare") {
    return <CompareEvidence message={message} />;
  }

  if (message.kind === "differentiate") {
    return <DerivativeEvidence message={message} />;
  }

  return (
    <MathRelation
      left={message.result.input.latex}
      relation={<InlineMath>=</InlineMath>}
      right={message.result.output.latex}
    />
  );
}

/** Renders derivative evidence without pretending the operation is binary. */
function DerivativeEvidence({ message }: Props) {
  const t = useTranslations("Ai");

  if (message.kind !== "differentiate" || message.status !== "verified") {
    return null;
  }

  return (
    <MathRelation
      left={message.result.input.latex}
      relation={t("math-derivative-relation")}
      right={message.result.output.latex}
    />
  );
}

/** Renders equivalence evidence without implying a result the engine did not prove. */
function CompareEvidence({ message }: Props) {
  const t = useTranslations("Ai");

  if (
    message.kind !== "compare" ||
    message.status === "loading" ||
    message.status === "error"
  ) {
    return null;
  }

  return (
    <MathRelation
      left={message.result.left.latex}
      relation={getCompareText(t, message.status)}
      right={message.result.right.latex}
    />
  );
}

/** Renders one readable relation without table-like labels. */
function MathRelation({
  left,
  relation,
  right,
}: {
  left: string;
  relation: ReactNode;
  right: string;
}) {
  return (
    <div className="flex w-fit max-w-full items-center gap-2 overflow-x-auto py-1 text-sm">
      <span className="shrink-0">
        <InlineMath>{left}</InlineMath>
      </span>
      <span className="shrink-0 text-muted-foreground">{relation}</span>
      <span className="shrink-0">
        <InlineMath>{right}</InlineMath>
      </span>
    </div>
  );
}

/** Selects localized comparison evidence text without badge-like status noise. */
function getCompareText(
  t: ReturnType<typeof useTranslations>,
  status: Props["message"]["status"]
) {
  if (status === "contradicted") {
    return t("math-compare-contradicted");
  }

  if (status === "inconclusive") {
    return t("math-compare-inconclusive");
  }

  return t("math-compare-verified");
}

/** Selects the icon that best matches the math operation. */
function getIcon(message: DataPart["math"]) {
  const icon = {
    compare: CongruentToIcon,
    differentiate: FunctionOfXIcon,
    evaluate: CalculateIcon,
    simplify: ApproximatelyEqualIcon,
  };

  return icon[message.kind];
}

/** Selects a localized title for the math evidence kind. */
function getTitle(
  t: ReturnType<typeof useTranslations>,
  message: DataPart["math"]
) {
  const title = {
    compare: t("math-compare"),
    differentiate: t("math-differentiate"),
    evaluate: t("math-evaluate"),
    simplify: t("math-simplify"),
  };

  return title[message.kind];
}
