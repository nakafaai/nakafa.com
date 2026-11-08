import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { EmptyState } from "@/components/state/empty";
import { DeferredFigure } from "@/components/state/mascot";

/**
 * The state of a school address that no page answers, with the one way on that the caller
 * composes. A school has no search page, so the state offers no search.
 */
export function TenantMissing({ children }: { children: ReactNode }) {
  const t = useTranslations("NotFound");

  return (
    <EmptyState
      action={children}
      description={t("description")}
      frame="page"
      scene={<DeferredFigure scene="missing" />}
      title={<h1>{t("title")}</h1>}
    />
  );
}
