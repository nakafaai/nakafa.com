"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { TryoutMeta } from "@/components/tryout/meta";
import { TryoutPageHead } from "@/components/tryout/page-head";
import { useTryoutPartHeadDescription } from "@/components/tryout/part-info";
import { useTryoutPart } from "@/components/tryout/part-state";

interface TryoutPartHeadProps {
  icon?: ComponentProps<typeof TryoutPageHead>["icon"];
}

export function TryoutPartHead({ icon }: TryoutPartHeadProps) {
  const tCommon = useTranslations("Common");
  const description = useTryoutPartHeadDescription();
  const partLabel = useTryoutPart((state) => state.state.part.label);
  const tryout = useTryoutPart((state) => state.state.tryout);

  return (
    <TryoutPageHead
      description={description}
      icon={icon}
      link={{
        href: `/try-out/${tryout.product}/${tryout.slug}`,
        label: tCommon("back"),
      }}
      meta={
        <TryoutMeta
          cycleKey={tryout.cycleKey}
          label={tryout.label}
          product={tryout.product}
        />
      }
      title={partLabel}
    />
  );
}
