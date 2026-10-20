"use client";

import { UnfoldMoreIcon } from "@hugeicons/core-free-icons";
import type {
  TenantProfile,
  ViewerAccount,
} from "@repo/backend/confect/tenancy/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@repo/design-system/components/ui/sidebar-content";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar-provider";
import {
  Sidebar,
  SidebarInset,
} from "@repo/design-system/components/ui/sidebar-shell";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { Link, usePathname } from "@repo/internationalization/src/navigation";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Effect, Option } from "effect";
import { type ReactNode, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { AccountMenu } from "@/components/sidebar/menu/account";
import { TenantAccountItems } from "@/components/tenant/account";
import { signOutSchoolAccount } from "@/components/tenant/account.client";
import {
  type ClassesPreload,
  ClassesPreloadContext,
} from "@/components/tenant/classes/preload";
import {
  TenantContext,
  type TenantValue,
  useTenant,
  ViewerPreloadContext,
} from "@/components/tenant/context";
import type { HomeAccess } from "@/components/tenant/home/access";
import type { Greeting } from "@/components/tenant/home/greeting";
import { SchoolMark } from "@/components/tenant/mark";
import { TenantNavigation } from "@/components/tenant/navigation";
import { isExamEditorPath } from "@/lib/settings/school";
import type { SchoolViewer } from "@/lib/tenant/frame";

/**
 * The schools of the viewer, which the school switcher lists. The list loads when the
 * switcher opens, as the account menu of Nakafa loads its own.
 */
const SidebarSchoolMenuItems = lazyComponent(
  () =>
    import("@/components/sidebar/menu/schools").then(
      (module) => module.SidebarSchoolMenuItems
    ),
  { loading: () => null, ssr: false }
);

/**
 * Signs out of the school, then returns to the school address, which shows the
 * sign-in surface. A failed sign-out shows its message and keeps the page. The
 * promise settles when the sign-out does, so the account waits for it.
 */
function signOutOfSchool() {
  return Effect.runPromise(
    Effect.gen(function* () {
      const destination = yield* signOutSchoolAccount();
      if (destination === "home") {
        window.location.assign("/");
      }
    })
  );
}

/**
 * The account button at the foot of the school's sidebar: the viewer's round
 * avatar, the viewer's name in the school, and the role, with the account menu.
 * The school layout reads the account on the server, so the footer has no pending
 * state of its own. A sign-out makes the account inert until it settles, so a
 * second press signs out once. The role line is left out for a viewer with no grant.
 */
function TenantAccount({
  account,
  name,
  role,
}: {
  account: typeof ViewerAccount.Type;
  name: string;
  role: TenantValue["role"];
}) {
  const t = useTranslations("School");
  const [isSigningOut, startSigningOut] = useTransition();

  return (
    <SidebarFooter className="border-t">
      <div inert={isSigningOut}>
        <SidebarMenu>
          <AccountMenu
            account={{
              mascot: account.mascot,
              photo: account.image,
            }}
            description={Option.match(role, {
              onNone: () => undefined,
              onSome: (value) => t(`role.${value}`),
            })}
            name={name}
            onSignOut={() => startSigningOut(() => signOutOfSchool())}
          >
            <TenantAccountItems username={account.username} />
          </AccountMenu>
        </SidebarMenu>
      </div>
    </SidebarFooter>
  );
}

/**
 * The school switcher at the top of the sidebar: the school's mark and name open the
 * viewer's schools, with the school's home and the way back to Nakafa beneath them.
 */
function TenantSwitcher() {
  const t = useTranslations("School");
  const locale = useLocale();
  const tenant = useTenant();

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              size="lg"
            >
              <SchoolMark logo={tenant.logo} mascot={tenant.mascot} />
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{tenant.name}</span>
              </div>
              <HugeIcons className="ml-auto" icon={UnfoldMoreIcon} />
            </SidebarMenuButton>
          }
        />
        <DropdownMenuContent align="start" className="min-w-56" sideOffset={4}>
          <SidebarSchoolMenuItems canOpenSchool={false} />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/">{t("home")}</Link>} />
            <DropdownMenuItem
              render={
                <a href={new URL(`/${locale}`, SITE_ORIGIN).href}>
                  {t("back-to-learning")}
                </a>
              }
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/**
 * The frame of a school's pages: the sidebar with the school's mark and name at its
 * top, the sidebar groups of the viewer, and the viewer's account at its foot, beside
 * the pages. Each page draws its one header, with the sidebar's trigger in it
 * (`SchoolHeader`), so the frame draws none. The exam editor draws its own frame,
 * so on its route the pages render alone. The pathname is read here, not in the
 * shell, so the shell's context value does not change on navigation.
 */
function TenantFrame({
  account,
  children,
  personName,
  role,
}: {
  account: typeof ViewerAccount.Type;
  children: ReactNode;
  personName: string;
  role: TenantValue["role"];
}) {
  const pathname = usePathname();
  const tCommon = useTranslations("Common");

  if (isExamEditorPath(pathname)) {
    return children;
  }

  return (
    <SidebarProvider>
      <Sidebar label={tCommon("sidebar")} side="left">
        <SidebarHeader className="border-b">
          <SidebarMenu>
            <TenantSwitcher />
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <TenantNavigation />
        </SidebarContent>
        <TenantAccount account={account} name={personName} role={role} />
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}

/**
 * The shell of a school: its mark and name at the top of the sidebar, the
 * sidebar groups of the signed-in viewer, and the viewer's account at the foot.
 * The school layout admits only members, so every item here is open to any
 * member of the school.
 */
export function TenantShell({
  account,
  canManage,
  canOpenExams,
  children,
  classes,
  greeting,
  home,
  personName,
  profile,
  role,
  viewer,
}: {
  account: typeof ViewerAccount.Type;
  canManage: boolean;
  canOpenExams: boolean;
  children: ReactNode;
  classes: ClassesPreload;
  greeting: Greeting;
  home: HomeAccess;
  personName: string;
  profile: typeof TenantProfile.Type;
  role: TenantValue["role"];
  viewer: SchoolViewer;
}) {
  return (
    <ViewerPreloadContext value={viewer}>
      <ClassesPreloadContext value={classes}>
        <TenantContext
          value={{
            canManage,
            canOpenExams,
            greeting,
            logo: profile.logo,
            mascot: profile.mascot,
            home,
            name: profile.name,
            role,
            slug: profile.slug,
          }}
        >
          <TenantFrame account={account} personName={personName} role={role}>
            {children}
          </TenantFrame>
        </TenantContext>
      </ClassesPreloadContext>
    </ViewerPreloadContext>
  );
}
