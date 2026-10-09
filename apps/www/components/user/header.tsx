"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "cn";
import { useTranslations } from "next-intl";
import { useViewer } from "@/lib/identity/client";
import { getInitialName } from "@/lib/utils/helper";

export function UserHeader({
  userId,
  initialProfile,
  initialOwnerEmail,
}: {
  userId: Id<"users">;
  initialProfile: Ref.Returns<typeof auth.queries.getUserById>;
  initialOwnerEmail: string | null;
}) {
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");

  const userQuery = useQuery(auth.queries.getUserById, {
    userId,
  });
  const user = QueryResult.isSuccess(userQuery)
    ? userQuery.value
    : initialProfile;
  const currentUser = useViewer((state) => state.account);
  const identityPending = useViewer((state) => state.isPending);
  if (QueryResult.isFailure(userQuery)) {
    throw userQuery.error;
  }
  const currentEmail =
    currentUser?.appUser._id === userId ? currentUser.authUser.email : null;
  const userEmail = identityPending ? initialOwnerEmail : currentEmail;
  const isCurrentUser = userEmail !== null;

  if (!user) {
    return (
      <header className="flex items-start justify-between gap-4">
        <section className="flex flex-1 items-start gap-4 text-left">
          <Avatar className="size-12 sm:size-16">
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
        <Avatar className="size-12 sm:size-16">
          <AvatarImage
            alt={user.name}
            role="presentation"
            src={user.image ?? ""}
          />
          <AvatarFallback>{getInitialName(user.name)}</AvatarFallback>
        </Avatar>
        <div className="grid text-left">
          <span className="truncate font-semibold text-base sm:text-lg">
            {user.name}
          </span>
          <span className="truncate text-muted-foreground text-sm sm:text-base">
            {userEmail ?? tCommon("anonymous")}
          </span>
        </div>
      </section>

      <Button
        className={cn("w-9 sm:w-auto", !isCurrentUser && "hidden")}
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
