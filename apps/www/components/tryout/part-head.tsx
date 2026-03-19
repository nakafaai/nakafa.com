"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { TryoutPageHeader } from "@/components/tryout/page-header";
import { TryoutPageMeta } from "@/components/tryout/page-meta";
import { useTryoutPartHeadDescription } from "@/components/tryout/part-info";
import { useTryoutPart } from "@/components/tryout/part-state";

interface TryoutPartHeadProps {
  icon?: ComponentProps<typeof TryoutPageHeader>["icon"];
}

export function TryoutPartHead({ icon }: TryoutPartHeadProps) {
  const tCommon = useTranslations("Common");
  const description = useTryoutPartHeadDescription();
  const partLabel = useTryoutPart((state) => state.state.part.label);
  const tryout = useTryoutPart((state) => state.state.tryout);

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
