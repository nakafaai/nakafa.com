"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { TryoutPageHeader } from "@/components/tryout/page-header";
import { TryoutPageMeta } from "@/components/tryout/page-meta";
import { useTryoutPart } from "@/components/tryout/providers/part-state";

interface TryoutPartHeadProps {
  icon?: ComponentProps<typeof TryoutPageHeader>["icon"];
}

export function TryoutPartHead({ icon }: TryoutPartHeadProps) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const isAwaitingExpiry = useTryoutPart(
    (state) => state.state.isAwaitingExpiry
  );
  const isTryoutFinished = useTryoutPart(
    (state) => state.state.isTryoutFinished
  );
  const partEndReason = useTryoutPart((state) => state.state.partEndReason);
  const partLabel = useTryoutPart((state) => state.state.part.label);
  const status = useTryoutPart((state) => state.state.status);
  const tryout = useTryoutPart((state) => state.state.tryout);

  let description = tTryouts("part-head-loading");

  if (status === "in-progress" && isAwaitingExpiry) {
    description = tTryouts("part-head-processing-expiry");
  } else {
    switch (status) {
      case "loading":
        description = tTryouts("part-head-loading");
        break;
      case "needs-tryout":
        description = tTryouts("part-head-needs-tryout");
        break;
      case "ended":
        description = tTryouts("part-head-ended");
        break;
      case "completed":
        if (!isTryoutFinished) {
          description =
            partEndReason === "time-expired"
              ? tTryouts("part-head-completed-time-expired-pending-review")
              : tTryouts("part-head-completed-pending-review");
          break;
        }

        description =
          partEndReason === "time-expired"
            ? tTryouts("part-head-completed-time-expired")
            : tTryouts("part-head-completed");
        break;
      case "in-progress":
        description = tTryouts("part-head-in-progress");
        break;
      case "ready":
        description = tTryouts("part-head-ready");
        break;
      default:
        description = tTryouts("part-head-loading");
        break;
    }
  }

  return (
    <TryoutPageHeader
      description={description}
      icon={icon}
      link={{
        href: `/try-out/${tryout.product}/${tryout.slug}`,
        label: tCommon("back"),
      }}
      meta={
        <TryoutPageMeta
          cycleKey={tryout.cycleKey}
          label={tryout.label}
          product={tryout.product}
        />
      }
      title={partLabel}
    />
  );
}
