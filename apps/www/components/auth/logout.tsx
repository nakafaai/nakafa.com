"use client";

import { Logout01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Effect, Either } from "effect";
import { useTranslations } from "next-intl";
import { signOutAccountBrowserIdentity } from "@/lib/auth/account-browser-identity";

export function AuthLogout() {
  const t = useTranslations("Auth");

  const router = useRouter();

  /** Signs the user out and returns them to the public home page on success. */
  async function handleSignOut() {
    const result = await Effect.runPromise(
      Effect.either(signOutAccountBrowserIdentity())
    );

    if (Either.isRight(result)) {
      router.replace("/");
    }
  }

  return (
    <Button onClick={handleSignOut}>
      <HugeIcons icon={Logout01Icon} />
      {t("logout")}
    </Button>
  );
}
