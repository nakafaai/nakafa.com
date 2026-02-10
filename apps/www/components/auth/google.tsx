"use client";

import { Google } from "@lobehub/icons";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { authClient } from "@/lib/auth/client";

interface Props {
  redirect?: string;
}

export function AuthGoogle({ redirect }: Props) {
  const t = useTranslations("Auth");

  const [redirectQuery] = useQueryState("redirect");

  const callbackURL = redirect ?? redirectQuery ?? "/";

  function handleGoogleSignIn() {
    const validCallbackURL = checkIfValidUrl(callbackURL) ? callbackURL : "/";
    authClient.signIn.social({
      provider: "google",
      callbackURL: validCallbackURL,
    });
  }

  return (
    <Button onClick={handleGoogleSignIn}>
      <Google />
      {t("continue-with-google")}
    </Button>
  );
}

function checkIfValidUrl(url: string): boolean {
  // Somehow, if callbackURL contains a comma, the sign in fails (edge case?)
  return !url.includes(",");
}
