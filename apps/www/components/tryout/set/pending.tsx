import type { Locale } from "next-intl";
import { ShellLockHold } from "@/components/sidebar/lock";
import {
  createTryoutSetRestartTarget,
  selectTryoutSetLinks,
} from "@/components/tryout/route/owner";
import { TryoutSetPageHeader } from "@/components/tryout/set/header";
import type { SetPage } from "@/components/tryout/set/model";
import { PendingTryoutAction } from "@/components/tryout/set/start";
import { TryoutPage } from "@/components/tryout/shell/header";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * Shows the set heading from the catalog while the learner's attempt loads. The
 * attempt decides everything below the heading, such as the countdown or the
 * result above the sections, so that part waits instead of moving later. The
 * shell stays as locked or unlocked as the page before it.
 */
export function TryoutSetPending({
  locale,
  page,
}: {
  locale: Locale;
  page: SetPage;
}) {
  const links = selectTryoutSetLinks(createTryoutSetRestartTarget(page));
  return (
    <TryoutPage>
      <ShellLockHold />
      <TryoutSetPageHeader
        action={
          isActiveLocale(locale) && page.entrySection ? (
            <PendingTryoutAction />
          ) : null
        }
        currentHref={links.currentHref}
        page={page}
        returnHref={links.returnHref}
      />
    </TryoutPage>
  );
}
