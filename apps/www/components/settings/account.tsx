"use client";

import { api } from "@repo/backend/convex/_generated/api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useQuery } from "convex/react";
import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { getInitialName } from "@/lib/utils/helper";

export function SettingsAccount() {
  const t = useTranslations("Auth");
  const user = useQuery(api.auth.getCurrentUser);

  const router = useRouter();

  if (!user) {
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
          <AvatarImage alt={user.name} src={user.image ?? ""} />
          <AvatarFallback className="rounded-lg">
            {getInitialName(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid flex-1 text-left leading-tight">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-muted-foreground text-sm">
            {user.email}
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
