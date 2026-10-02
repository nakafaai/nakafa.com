import type { Locale } from "next-intl";
import { TryoutSectionPageHeader } from "@/components/tryout/section/header";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";
import { PendingTryoutAction } from "@/components/tryout/set/start";
import { TryoutPage, TryoutPageBody } from "@/components/tryout/shell/header";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * Paints the section from the cached catalog while the learner's attempt
 * loads: its heading and its question count and time, where the resolved page
 * shows them. Only the action waits.
 */
export function TryoutSectionPending({
  locale,
  page,
  setHref,
}: {
  locale: Locale;
  page: TryoutSectionPage;
  setHref: string;
}) {
  return (
    <TryoutPage>
      <TryoutSectionPageHeader
        action={isActiveLocale(locale) ? <PendingTryoutAction /> : null}
        page={page}
        parents="linked"
        setHref={setHref}
      />
      <TryoutPageBody>
        <TryoutSectionSummary
          value={{ score: null, section: page.section, sectionStatus: null }}
        />
      </TryoutPageBody>
    </TryoutPage>
  );
}
