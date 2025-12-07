"use client";

import { api } from "@repo/backend/convex/_generated/api";
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
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useQuery } from "convex/react";
import { EllipsisVerticalIcon, LogInIcon, LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth/client";
import { getInitialName } from "@/lib/utils/helper";

export function SchoolSidebarNavUser() {
  const t = useTranslations("Auth");

  const pathname = usePathname();

  const router = useRouter();
  const user = useQuery(api.auth.getCurrentUser);

  const { isMobile } = useSidebar();

  async function handleSignOut() {
    await authClient.signOut();
    router.replace(`/auth?redirect=${pathname}`);
  }

  if (!user) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => router.push(`/auth?redirect=${pathname}`)}
        >
          <LogInIcon />
          {t("login")}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <Avatar className="size-6 rounded-lg">
              <AvatarImage
                alt={user.authUser.name}
                src={user.authUser.image ?? ""}
              />
              <AvatarFallback className="rounded-lg text-xs">
                {getInitialName(user.authUser.name)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate">{user.authUser.name}</span>
            </div>
            <EllipsisVerticalIcon className="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          sideOffset={4}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="size-8 rounded-lg">
                <AvatarImage
                  alt={user.authUser.name}
                  src={user.authUser.image ?? ""}
                />
                <AvatarFallback className="rounded-lg">
                  {getInitialName(user.authUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate text-foreground">
                  {user.authUser.name}
                </span>
                <span className="truncate text-muted-foreground text-xs">
                  {user.authUser.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={handleSignOut}
            >
              <LogOutIcon />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
