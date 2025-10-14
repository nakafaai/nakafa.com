"use client";

import { SiGoogle } from "@icons-pack/react-simple-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { authClient } from "@/lib/auth/client";

export function AuthGoogle() {
  const t = useTranslations("Auth");

  const [redirect] = useQueryState("redirect");

  async function handleGoogleSignIn() {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirect ?? "/",
    });
  }

  return (
    <Button onClick={handleGoogleSignIn}>
      <SiGoogle />
      {t("continue-with-google")}
    </Button>
  );
}
