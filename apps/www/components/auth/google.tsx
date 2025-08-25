"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { SiGoogle } from "@icons-pack/react-simple-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { useTranslations } from "next-intl";

export function AuthGoogle() {
  const t = useTranslations("Auth");
  const { signIn } = useAuthActions();

  return (
    <Button onClick={() => signIn("google")}>
      <SiGoogle />
      {t("continue-with-google")}
    </Button>
  );
}
