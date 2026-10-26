import { SITE_ORIGIN } from "@repo/seo/origin";
import { useLocale, useTranslations } from "use-intl";
import { ActionLink } from "@/components/state/action";
import { DeferredFigure } from "@/components/state/mascot";
import {
  Screen,
  ScreenActions,
  ScreenDescription,
  ScreenFigure,
  ScreenHeader,
  ScreenTitle,
} from "@/components/state/screen";

/**
 * The page of a school whose access the viewer has lost: a removed or demoted
 * member. Nina keeps something safe, one sentence says whom to ask, and the way
 * back leads to Nakafa, because no school page can show the viewer's pages now.
 */
export function TenantRefused() {
  const t = useTranslations("School");
  const locale = useLocale();
  const homeHref = new URL(`/${locale}`, SITE_ORIGIN).href;

  return (
    <Screen>
      <ScreenHeader>
        <ScreenFigure>
          <DeferredFigure scene="refused" />
        </ScreenFigure>
        <ScreenTitle>{t("refused-title")}</ScreenTitle>
        <ScreenDescription>{t("refused-description")}</ScreenDescription>
      </ScreenHeader>
      <ScreenActions>
        <ActionLink
          href={homeHref}
          label={t("back-to-learning")}
          variant="default"
        />
      </ScreenActions>
    </Screen>
  );
}
