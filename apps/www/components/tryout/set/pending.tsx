import type { Locale } from "next-intl";
import {
  createTryoutSetRestartTarget,
  selectTryoutSetLinks,
} from "@/components/tryout/route/owner";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";
import { TryoutSetPageHeader } from "@/components/tryout/set/header";
import type { SetPage } from "@/components/tryout/set/model";
import { TryoutSectionRows } from "@/components/tryout/set/rows.client";
import { PendingTryoutAction } from "@/components/tryout/set/start";
import { TryoutPage, TryoutPageBody } from "@/components/tryout/shell/header";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * Paints the set from the cached catalog while the learner's attempt loads:
 * its heading, and its section list or its single entry's facts, where the
 * resolved page shows them. Only the action and the result wait.
 */
export function TryoutSetPending({
  locale,
  page,
}: {
  locale: Locale;
  page: SetPage;
}) {
  const links = selectTryoutSetLinks(createTryoutSetRestartTarget(page));
  const entrySection = page.entrySection;
  return (
    <TryoutPage>
      <TryoutSetPageHeader
        action={
          isActiveLocale(locale) && entrySection ? (
            <PendingTryoutAction />
          ) : null
        }
        currentHref={links.currentHref}
        page={page}
        returnHref={links.returnHref}
      />
      <TryoutPageBody>
        {entrySection?.visibility === "internal-entry" ? (
          <TryoutSectionSummary
            value={{ score: null, section: entrySection, sectionStatus: null }}
          />
        ) : (
          <TryoutSectionRows sections={page.sections} />
        )}
      </TryoutPageBody>
    </TryoutPage>
  );
}
