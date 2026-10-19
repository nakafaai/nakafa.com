"use client";

import { useTranslations } from "next-intl";
import { ActionLink } from "@/components/state/action";
import { DeferredFigure } from "@/components/state/figure.client";
import { Screen } from "@/components/state/screen";

/**
 * The page of a school whose access the viewer has lost: a removed or demoted
 * member. Nina keeps something safe, one sentence says whom to ask, and the way
 * back leads to Nakafa, because no school page can show the viewer's pages now.
 */
export function TenantRefused({ homeHref }: { homeHref: string }) {
  const t = useTranslations("School");

  return (
    <Screen
      actions={
        <ActionLink
          href={homeHref}
          label={t("back-to-learning")}
          variant="default"
        />
      }
      description={t("refused-description")}
      figure={<DeferredFigure scene="refused" />}
      title={t("refused-title")}
    />
  );
}
