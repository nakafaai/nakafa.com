import { Logout01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { useDisclosure } from "@mantine/hooks";
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
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  SidebarMenuButton,
  SidebarMenuDescription,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useSidebar } from "@repo/design-system/lib/sidebar/context";
import type { Mascot } from "@repo/mascot/code";
import { type ReactNode, useLayoutEffect } from "react";
import { useTranslations } from "use-intl";

/**
 * The account menu every sidebar shares: the account button, the account at the
 * top of the menu (its name over its email, or over its role in a school) and
 * sign-out at its bottom. Each sidebar gives the name and the
 * second line of its button, the account it shows, and its own sign-out, and
 * composes its own sections between them.
 */
export function AccountMenu({
  account,
  children,
  description,
  name,
  onSignOut,
}: {
  account: {
    /** The account's email, shown under its name at the top of the menu. A school's account has none, and its role shows there instead. */
    email?: string | undefined;
    /** The animal that draws the account when it shows no photo. */
    mascot: typeof Mascot.Type;
    /** The photo the account shows, or none. */
    photo?: string | undefined;
  };
  children: ReactNode;
  /** The second line of the account button, such as a plan or a role. Left out, the button has one line. */
  description?: string | undefined;
  /** The name on the account button: the school person's name in a school, the account's name on the main site. */
  name: string;
  /** Signs the viewer out, then leaves the page the way the sidebar needs. */
  onSignOut: () => void;
}) {
  const t = useTranslations("Auth");
  const [open, { close, set }] = useDisclosure(false);
  const side = useSidebar((sidebar) => (sidebar.isMobile ? "bottom" : "right"));

  useLayoutEffect(() => close, [close]);

  return (
    <SidebarMenuItem>
      <DropdownMenu onOpenChange={set} open={open}>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              size="lg"
            >
              <PersonAvatar mascot={account.mascot} photo={account.photo} />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate">{name}</span>
                {description === undefined ? null : (
                  <SidebarMenuDescription>{description}</SidebarMenuDescription>
                )}
              </div>
              <HugeIcons className="ml-auto" icon={MoreVerticalIcon} />
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-(--anchor-width) min-w-56 max-w-[calc(100vw-2rem)] rounded-lg"
          side={side}
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <PersonAvatar mascot={account.mascot} photo={account.photo} />
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-foreground">
                    {name}
                  </span>
                  {(account.email ?? description) === undefined ? null : (
                    <span className="truncate text-muted-foreground text-xs">
                      {account.email ?? description}
                    </span>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {children}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className="cursor-pointer" onClick={onSignOut}>
              <HugeIcons icon={Logout01Icon} />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
