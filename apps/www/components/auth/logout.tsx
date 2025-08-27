"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@repo/design-system/components/ui/button";
import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function AuthLogout() {
  const t = useTranslations("Auth");
  const { signOut } = useAuthActions();

  return (
    <Button onClick={() => signOut()}>
      <LogOutIcon />
      {t("logout")}
    </Button>
  );
}
