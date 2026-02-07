"use client";

import { Settings01Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useUser } from "@/lib/context/use-user";
import { getInitialName } from "@/lib/utils/helper";

export function UserHeader({ userId }: { userId: Id<"users"> }) {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");

  const { data: user } = useQueryWithStatus(api.auth.getUserById, { userId });
  const currentUser = useUser((state) => state.user);

  const authUser = user?.authUser;
  const appUser = user?.appUser;

  if (!(authUser && appUser)) {
    return (
      <header className="flex items-start justify-between gap-4">
        <section className="flex flex-1 items-start gap-4 text-left">
          <Avatar className="size-12 border sm:size-16">
            <AvatarImage
              alt={tCommon("anonymous")}
              role="presentation"
              src=""
            />
            <AvatarFallback>
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
        <Avatar className="size-12 border sm:size-16">
          <AvatarImage
            alt={authUser.name}
            role="presentation"
            src={authUser.image ?? ""}
          />
          <AvatarFallback>{getInitialName(authUser.name)}</AvatarFallback>
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
        className={cn(
          "w-9 sm:w-auto",
          currentUser?.appUser._id !== appUser._id && "hidden"
        )}
        nativeButton={false}
        render={
          <NavigationLink href="/user/settings">
            <HugeIcons icon={Settings01Icon} />
            <span className="hidden sm:inline">{t("settings")}</span>
          </NavigationLink>
        }
        variant="outline"
      />
    </header>
  );
}
