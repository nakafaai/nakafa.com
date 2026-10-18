"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";

/** Signs the visitor out, then opens the school root at `path`, once the sign-out succeeds. */
async function signOutThen(path: string) {
  const result = await Effect.runPromise(
    Effect.result(signOutAccountBrowserIdentity())
  );
  if (Result.isSuccess(result)) {
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
