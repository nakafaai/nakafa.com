import { useTranslations } from "use-intl";
import { ActionLink } from "@/components/state/action";
import { Missing } from "@/components/state/missing";

/**
 * The state of a school address that no page answers, with one way on to
 * `homeHref`. A school has no search page, so the state offers no search.
 */
export function TenantMissing({ homeHref }: { homeHref: string }) {
  const t = useTranslations("NotFound");
  const tState = useTranslations("State");

  return (
    <Missing description={t("description")} title={t("title")}>
      <ActionLink
        href={homeHref}
        label={tState("home-button")}
        variant="default"
      />
    </Missing>
  );
}
