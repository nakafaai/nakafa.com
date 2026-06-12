"use client";

import { Logout01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect } from "react";
import { NavUserGuestButton } from "@/components/sidebar/nav-user-guest-button";
import { NavUserSkeleton } from "@/components/sidebar/nav-user-skeleton";
import { SidebarUtilityMenuItems } from "@/components/sidebar/utility-menu-items";
import { authClient } from "@/lib/auth/client";
import { useUser } from "@/lib/context/use-user";
import { getInitialName } from "@/lib/utils/helper";

/**
 * Renders the signed-in school user menu, plan indicator, and guest login shortcut.
 */
export function SchoolSidebarNavUser() {
  const t = useTranslations("Auth");

  const pathname = usePathname();

  const router = useRouter();
  const { isPending, user } = useUser((state) => ({
    isPending: state.isPending,
    user: state.user,
  }));
  const [open, { close, set }] = useDisclosure(false);

  const { isMobile } = useSidebar();
  const authHref = `/auth?redirect=${pathname}`;
  const dropdownSide = isMobile ? "bottom" : "right";
  const submenuSide = isMobile ? "top" : "right";

  useLayoutEffect(() => close, [close]);

  /** Signs the user out and leaves the shared authenticated app subtree on success. */
  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace(authHref);
        },
      },
    });
  }

  if (isPending) {
    return <NavUserSkeleton />;
  }

  if (!user) {
    return (
      <SidebarMenuItem>
        <NavUserGuestButton />
      </SidebarMenuItem>
    );
  }

  const planLabelByPlan = {
    free: t("plan-free"),
    pro: t("plan-pro"),
  };
  const planLabel = planLabelByPlan[user.appUser.plan];

  return (
    <SidebarMenuItem>
      <DropdownMenu onOpenChange={set} open={open}>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar>
                <AvatarImage
                  alt={user.authUser.name}
                  role="presentation"
                  src={user.authUser.image ?? ""}
                />
                <AvatarFallback className="text-xs">
                  {getInitialName(user.authUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate">{user.authUser.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                  {planLabel}
                </span>
              </div>
              <HugeIcons className="ml-auto" icon={MoreVerticalIcon} />
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-(--anchor-width) min-w-56 max-w-[calc(100vw-2rem)] rounded-lg"
          side={dropdownSide}
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar>
                  <AvatarImage
                    alt={user.authUser.name}
                    role="presentation"
                    src={user.authUser.image ?? ""}
                  />
                  <AvatarFallback>
                    {getInitialName(user.authUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-foreground">
                    {user.authUser.name}
                  </span>
                  <span className="truncate text-muted-foreground text-xs">
                    {user.authUser.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <SidebarUtilityMenuItems side={submenuSide} />
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={handleSignOut}
            >
              <HugeIcons icon={Logout01Icon} />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
