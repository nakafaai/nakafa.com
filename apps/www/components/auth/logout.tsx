"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function AuthLogout() {
  const t = useTranslations("Auth");

  const router = useRouter();

  const { signOut } = useAuthActions();

  return (
    <Button onClick={() => signOut().then(() => router.replace("/"))}>
      <LogOutIcon />
      {t("logout")}
    </Button>
  );
}
