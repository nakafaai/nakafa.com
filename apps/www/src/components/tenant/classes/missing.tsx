import { useTranslations } from "use-intl";
import { PageState } from "@/components/shared/page/body";
import { ActionLink } from "@/components/state/action";
import { EmptyState } from "@/components/state/empty";
import { DeferredFigure } from "@/components/state/mascot";

/** The missing state of something a class page names but the viewer may not read, with one way back to the school's home. */
export function ClassMissingBody() {
  const t = useTranslations("NotFound");
  const tState = useTranslations("State");

  return (
    <PageState>
      <EmptyState
        action={
          <ActionLink
            href="/"
            label={tState("home-button")}
            variant="default"
          />
        }
        description={t("description")}
        frame="page"
        scene={<DeferredFigure scene="missing" />}
        title={<h1>{t("title")}</h1>}
      />
    </PageState>
  );
}
