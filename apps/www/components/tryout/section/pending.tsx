import type { Locale } from "next-intl";
import { ShellLockHold } from "@/components/sidebar/lock";
import { TryoutSectionPageHeader } from "@/components/tryout/section/header";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import { PendingTryoutAction } from "@/components/tryout/set/start";
import { TryoutPage } from "@/components/tryout/shell/header";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * Shows the section heading from the catalog while the learner's attempt
 * loads. The attempt decides everything below the heading, such as the start
 * facts, a score, or a running section, so that part waits instead of moving
 * later. The shell stays as locked or unlocked as the page before it.
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
      <ShellLockHold />
      <TryoutSectionPageHeader
        action={isActiveLocale(locale) ? <PendingTryoutAction /> : null}
        page={page}
        parents="linked"
        setHref={setHref}
      />
    </TryoutPage>
  );
}
