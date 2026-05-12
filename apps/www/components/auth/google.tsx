"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { BrandIcon } from "@/components/shared/brand-icon";
import { authClient } from "@/lib/auth/client";
import { getAuthCallbackPath } from "@/lib/auth/utils";

interface Props {
  redirect?: string;
}

/** Renders the Google sign-in button with one sanitized internal callback URL. */
export function AuthGoogle({ redirect }: Props) {
  const locale = useLocale();
  const t = useTranslations("Auth");

  const [redirectQuery] = useQueryState("redirect");

  const callbackURL = getAuthCallbackPath(redirect ?? redirectQuery, locale);

  /** Starts the Better Auth Google flow with one safe callback destination. */
  function handleGoogleSignIn() {
    authClient.signIn.social({
      provider: "google",
      callbackURL,
    });
  }

  return (
    <Button onClick={handleGoogleSignIn}>
      <BrandIcon src="/ai-logos/google.svg" />
      {t("continue-with-google")}
    </Button>
  );
}
