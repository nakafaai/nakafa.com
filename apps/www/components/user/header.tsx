"use client";

import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Animal } from "@repo/design-system/components/ui/animal";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { type CurrentUser, useViewer } from "@/lib/identity/client";

/**
 * The header of the owner's own profile: the name and the address on the left,
 * the animal on the right, the bio under them, and the button that edits the
 * profile. A profile opens only for its owner, so the header shows nothing
 * about anyone else.
 */
export function UserHeader({
  initialAccount,
  username,
}: {
  initialAccount: CurrentUser;
  username: string;
}) {
  const t = useTranslations("Auth");
  const identity = useViewer((state) => state);
  const account = identity.isPending ? initialAccount : identity.account;

  if (!account) {
    return null;
  }

  const { appUser, authUser } = account;
  return (
    <section className="grid gap-4">
      <header className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="truncate font-semibold text-2xl sm:text-3xl">
            {authUser.name}
          </h1>
          <p className="truncate text-base text-muted-foreground">
            @{username}
          </p>
        </div>
        <Avatar className="size-24 shrink-0">
          <AvatarImage
            alt={authUser.name}
            role="presentation"
            src={authUser.image ?? appUser.image ?? ""}
          />
          <AvatarFallback>
            <Animal mascot={appUser.mascot} />
          </AvatarFallback>
        </Avatar>
      </header>
      {appUser.bio ? (
        <p className="text-pretty text-base">{appUser.bio}</p>
      ) : null}
      <div>
        <Button
          nativeButton={false}
          render={
            <NavigationLink href="/user/settings">
              <HugeIcons icon={PencilEdit02Icon} />
              {t("edit-profile")}
            </NavigationLink>
          }
          variant="outline"
        />
      </div>
    </section>
  );
}
