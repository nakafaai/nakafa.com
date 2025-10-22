import { api } from "@repo/backend/convex/_generated/api";
import type { AnyAppUser } from "@repo/backend/convex/auth";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import { useQuery } from "convex/react";
import { SettingsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getInitialName } from "@/lib/utils/helper";

type Props = {
  user: AnyAppUser;
};

export function UserHeader({ user }: Props) {
  const t = useTranslations("Auth");

  const currentUser = useQuery(api.auth.getCurrentUser);

  const authUser = user.authUser;
  const appUser = user.appUser;

  return (
    <header className="flex items-start justify-between gap-4">
      <section className="flex flex-1 items-start gap-4 text-left">
        <Avatar className="size-12 rounded-full sm:size-16">
          <AvatarImage alt={authUser.name} src={authUser.image ?? ""} />
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
          <SettingsIcon />
          <span className="hidden sm:inline">{t("settings")}</span>
        </NavigationLink>
      </Button>
    </header>
  );
}
