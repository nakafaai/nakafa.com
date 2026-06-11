"use client";

import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";

export function AuthLogout() {
  const t = useTranslations("Auth");

  const router = useRouter();

  /** Signs the user out and returns them to the public home page on success. */
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
      <HugeIcons icon={Logout01Icon} />
      {t("logout")}
    </Button>
  );
}
