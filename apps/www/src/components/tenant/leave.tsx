"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { signOutSchoolAccount } from "@/components/tenant/signout";

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
 * The ways out of a school a signed-in visitor is not a member of: check again, switch the account,
 * or sign in with a card. Checking again reads the membership once more, because an invite that an
 * admin just sent may take a moment to appear. Both sign-outs sign the account out first, because a
 * card is redeemed only from a signed-out device, and the card form opens from the address
 * `?masuk=username`. Each way out is inert until its sign-out settles, so a second press signs out once.
 */
export function TenantOutsiderActions() {
  const t = useTranslations("SchoolEntry");
  const router = useRouter();
  const [isSigningOut, startSigningOut] = useTransition();

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Button onClick={() => router.refresh()} variant="outline">
        {t("outsider-check-again")}
      </Button>
      <Button
        disabled={isSigningOut}
        inert={isSigningOut}
        onClick={() => startSigningOut(() => signOutThen("/"))}
        variant="outline"
      >
        {t("outsider-switch")}
      </Button>
      <Button
        disabled={isSigningOut}
        inert={isSigningOut}
        onClick={() => startSigningOut(() => signOutThen("/?masuk=username"))}
      >
        {t("outsider-card")}
      </Button>
    </div>
  );
}
