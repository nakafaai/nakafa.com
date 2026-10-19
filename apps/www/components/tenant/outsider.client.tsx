"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { signOutSchoolAccount } from "@/components/tenant/account.client";

/**
 * Signs the visitor out, then opens the school root at `path`, once the sign-out succeeds. A
 * failed sign-out shows its message, and the visitor stays on the page.
 */
async function signOutThen(path: string) {
  const destination = await Effect.runPromise(signOutSchoolAccount());
  if (destination === "home") {
    window.location.assign(path);
  }
}

/**
 * The two ways out of a school a signed-in visitor is not a member of: switch the account,
 * or sign in with a card. Both sign the account out first, because a card is redeemed only
 * from a signed-out device, and the card form opens from the address `?masuk=username`.
 */
export function TenantOutsiderActions() {
  const t = useTranslations("SchoolEntry");

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button onClick={() => signOutThen("/")} variant="outline">
        {t("outsider-switch")}
      </Button>
      <Button onClick={() => signOutThen("/?masuk=username")}>
        {t("outsider-card")}
      </Button>
    </div>
  );
}
