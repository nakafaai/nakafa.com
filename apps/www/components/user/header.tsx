"use client";

import { Settings01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { getInitialName } from "@/lib/utils/helper";

export function UserHeader({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");

  const user = useQuery(api.auth.getUserById, { userId });
  const currentUser = useQuery(api.auth.getCurrentUser);

  const authUser = user?.authUser;
  const appUser = user?.appUser;

  if (!(authUser && appUser)) {
    return (
      <header className="flex items-start justify-between gap-4">
        <section className="flex flex-1 items-start gap-4 text-left">
          <Avatar className="size-12 rounded-full border sm:size-16">
            <AvatarImage
              alt={tCommon("anonymous")}
              role="presentation"
              src=""
            />
            <AvatarFallback className="rounded-lg">
              {getInitialName(tCommon("anonymous"))}
            </AvatarFallback>
          </Avatar>
          <div className="grid text-left">
            <span className="truncate font-semibold text-base sm:text-lg">
              {tCommon("anonymous")}
            </span>
            <span className="truncate text-muted-foreground text-sm sm:text-base">
              {tCommon("anonymous")}
            </span>
          </div>
        </section>
      </header>
    );
  }

  return (
    <header className="flex items-start justify-between gap-4">
      <section className="flex flex-1 items-start gap-4 text-left">
        <Avatar className="size-12 rounded-full border sm:size-16">
          <AvatarImage
            alt={authUser.name}
            role="presentation"
            src={authUser.image ?? ""}
          />
          <AvatarFallback className="rounded-lg">
            {getInitialName(authUser.name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid text-left">
          <span className="truncate font-semibold text-base sm:text-lg">
            {authUser.name}
          </span>
          <span className="truncate text-muted-foreground text-sm sm:text-base">
            {authUser.email}
          </span>
        </div>
      </section>

      <Button
        asChild
        className={cn(
          "w-9 sm:w-auto",
          currentUser?.appUser._id !== appUser._id && "hidden"
        )}
        variant="outline"
      >
        <NavigationLink href="/user/settings">
          <HugeIcons icon={Settings01Icon} />
          <span className="hidden sm:inline">{t("settings")}</span>
        </NavigationLink>
      </Button>
    </header>
  );
}
