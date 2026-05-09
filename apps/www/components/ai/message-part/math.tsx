"use client";

import {
  AlertCircleIcon,
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  EqualSignIcon,
  FunctionOfXIcon,
  MathIcon,
  NotEqualSignIcon,
} from "@hugeicons/core-free-icons";
import type { DataPart } from "@repo/ai/schema/data";
import { BlockMathKatex } from "@repo/design-system/components/markdown/math";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";
import { memo, useState } from "react";

interface Props {
  message: DataPart["math"];
}

const iconVariants = cva("size-4 shrink-0", {
  variants: {
    status: {
      contradicted: "text-destructive",
      error: "text-destructive",
      inconclusive: "text-secondary",
      loading: "text-muted-foreground",
      verified: "text-primary",
    },
  },
});

export const MathPart = memo(({ message }: Props) => {
  const t = useTranslations("Ai");
  const [open, setOpen] = useState(message.status !== "loading");

  const icon = getIcon(message);

  return (
    <Collapsible
      className="overflow-hidden rounded-md border"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between bg-muted/80 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <HugeIcons
            className={iconVariants({ status: message.status })}
            icon={icon}
          />
          <span className="truncate text-sm">{getTitle(t, message)}</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-muted-foreground text-xs">
            {t(`math-status-${message.status}`)}
          </span>
        </div>
        <HugeIcons
          className={cn(
            "size-4 shrink-0 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
          icon={ArrowDown01Icon}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t bg-muted/40 px-4 py-3 text-sm">
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
    return <p className="text-destructive">{message.error}</p>;
  }

  if (message.kind === "compare") {
    return (
      <div className="space-y-3">
        <MathPair
          left={message.result.left.latex}
          right={message.result.right.latex}
        />
        <p className="text-muted-foreground">{message.result.reason}</p>
      </div>
    );
  }

  return (
    <MathPair
      left={message.result.input.latex}
      right={message.result.output.latex}
    />
  );
}

/** Renders two mathematical expressions with an equality marker. */
function MathPair({ left, right }: { left: string; right: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
      <BlockMathKatex>{left}</BlockMathKatex>
      <HugeIcons
        className="size-4 text-muted-foreground"
        icon={EqualSignIcon}
      />
      <BlockMathKatex>{right}</BlockMathKatex>
    </div>
  );
}

/** Selects the icon that best matches the math evidence state. */
function getIcon(message: DataPart["math"]) {
  if (message.status === "error" || message.status === "inconclusive") {
    return AlertCircleIcon;
  }

  if (message.status === "contradicted") {
    return NotEqualSignIcon;
  }

  if (message.kind === "differentiate") {
    return FunctionOfXIcon;
  }

  if (message.status === "verified") {
    return CheckmarkCircle02Icon;
  }

  return MathIcon;
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
