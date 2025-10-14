"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";

export function AuthLogout() {
  const t = useTranslations("Auth");

  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/");
        },
      },
    });
  }

  return (
    <Button onClick={handleSignOut}>
      <LogOutIcon />
      {t("logout")}
    </Button>
  );
}
