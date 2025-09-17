"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { getInitialName } from "@/lib/utils/helper";

export function SettingsAccount() {
  const t = useTranslations("Auth");
  const { data } = authClient.useSession();

  const router = useRouter();

  if (!data) {
    return null;
  }

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/");
        },
      },
    });
  };

  return (
    <main className="space-y-4">
      <div className="flex items-center gap-2 text-left">
        <Avatar className="size-10 rounded-lg">
          <AvatarImage alt={data.user.name} src={data.user.image ?? ""} />
          <AvatarFallback className="rounded-lg">
            {getInitialName(data.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate font-medium">{data.user.name}</span>
          <span className="truncate text-muted-foreground text-sm">
            {data.user.email}
          </span>
        </div>
      </div>

      <Button onClick={handleSignOut}>
        <LogOutIcon />
        {t("logout")}
      </Button>
    </main>
  );
}
