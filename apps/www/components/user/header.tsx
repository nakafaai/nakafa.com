"use client";

import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { photoOf } from "@repo/backend/confect/users/picture";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { useTranslations } from "next-intl";
import { type CurrentUser, useViewer } from "@/lib/identity/client";

/**
 * The header of the owner's own profile: the name and the address on the left,
 * the picture on the right, the bio under them, and the full-width button that
 * edits the profile. A profile opens only for its owner, so the header shows
 * nothing about anyone else.
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
    <section className="grid gap-4 pb-6">
      <header className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="truncate font-semibold text-2xl sm:text-3xl">
            {authUser.name}
          </h1>
          <p className="truncate text-base text-muted-foreground">
            @{username}
          </p>
        </div>
        <PersonAvatar
          className="size-14 shrink-0 md:size-21"
          mascot={appUser.mascot}
          photo={photoOf(appUser)}
        />
      </header>
      {appUser.bio ? (
        <p className="wrap-break-word line-clamp-3 whitespace-pre-line text-pretty text-base">
          {appUser.bio}
        </p>
      ) : null}
      <Button
        className="w-full"
        nativeButton={false}
        render={
          <NavigationLink href="/user/settings">
            <HugeIcons icon={PencilEdit02Icon} />
            {t("edit-profile")}
          </NavigationLink>
        }
        variant="outline"
      />
    </section>
  );
}
