"use client";

import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { useTranslations } from "next-intl";
import { ShareProfileButton } from "@/components/user/share";
import type { PublicProfile } from "@/lib/profile/public";

/**
 * The header of a profile: the name and the address on the left, the picture on
 * the right, the bio under them, and one row of buttons. The owner edits the
 * profile, and everyone shares it.
 */
export function UserHeader({
  isOwner,
  profile,
}: {
  isOwner: boolean;
  profile: PublicProfile;
}) {
  const t = useTranslations("Auth");

  return (
    <section className="grid gap-4 pb-6">
      <header className="flex items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="wrap-anywhere text-balance font-semibold text-2xl sm:text-3xl">
            {profile.name}
          </h1>
          <p className="truncate text-base text-muted-foreground">
            @{profile.username}
          </p>
        </div>
        <PersonAvatar
          className="size-14 shrink-0 md:size-21"
          mascot={profile.mascot}
          photo={profile.image}
        />
      </header>
      {profile.bio ? (
        <p className="wrap-anywhere whitespace-pre-line text-pretty text-base">
          {profile.bio}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        {isOwner && (
          <Button
            className="flex-1"
            nativeButton={false}
            render={
              <NavigationLink href="/user/settings">
                <HugeIcons icon={PencilEdit02Icon} />
                {t("edit-profile")}
              </NavigationLink>
            }
            variant="outline"
          />
        )}
        <ShareProfileButton username={profile.username} />
      </div>
    </section>
  );
}
