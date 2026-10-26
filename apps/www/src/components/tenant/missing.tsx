import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Missing } from "@/components/state/missing";

/**
 * The state of a school address that no page answers, with the one way on that the caller
 * composes. A school has no search page, so the state offers no search.
 */
export function TenantMissing({ children }: { children: ReactNode }) {
  const t = useTranslations("NotFound");

  return (
    <Missing description={t("description")} title={t("title")}>
      {children}
    </Missing>
  );
}
