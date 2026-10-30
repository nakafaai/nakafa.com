import { useTranslations } from "use-intl";
import { ActionLink } from "@/components/state/action";
import { Missing } from "@/components/state/missing";

/** The missing state of something a class page names but the viewer may not read, with one way back to the school's home. */
export function ClassMissingBody() {
  const t = useTranslations("NotFound");
  const tState = useTranslations("State");

  return (
    <Missing description={t("description")} title={t("title")}>
      <ActionLink href="/" label={tState("home-button")} variant="default" />
    </Missing>
  );
}
