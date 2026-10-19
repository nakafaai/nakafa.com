"use client";

import type {
  TenantProfile,
  ViewerAccount,
} from "@repo/backend/confect/tenancy/schema";
import { IntentLink } from "@repo/design-system/components/ui/intent-link";
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
import { usePathname } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { useTranslations } from "next-intl";
import { type ReactNode, useTransition } from "react";
import { AccountMenu } from "@/components/sidebar/menu/account";
import { TenantAccountItems } from "@/components/tenant/account";
import { signOutSchoolAccount } from "@/components/tenant/account.client";
import { TenantContext, type TenantValue } from "@/components/tenant/context";
import type { HomeAccess } from "@/components/tenant/home/access";
import { SchoolMark } from "@/components/tenant/mark";
import { TenantNavigation } from "@/components/tenant/navigation";
import { isExamEditorPath } from "@/lib/settings/school";

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
            description={role === null ? undefined : t(`role.${role}`)}
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
  profile,
  role,
}: {
  account: typeof ViewerAccount.Type;
  children: ReactNode;
  personName: string;
  profile: typeof TenantProfile.Type;
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
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<IntentLink href="/" localized={false} />}
                size="lg"
              >
                <SchoolMark logo={profile.logo} mascot={profile.mascot} />
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{profile.name}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
  home,
  personName,
  profile,
  role,
}: {
  account: typeof ViewerAccount.Type;
  canManage: boolean;
  canOpenExams: boolean;
  children: ReactNode;
  home: HomeAccess;
  personName: string;
  profile: typeof TenantProfile.Type;
  role: TenantValue["role"];
}) {
  return (
    <TenantContext
      value={{
        canManage,
        canOpenExams,
        home,
        name: profile.name,
        role,
        slug: profile.slug,
      }}
    >
      <TenantFrame
        account={account}
        personName={personName}
        profile={profile}
        role={role}
      >
        {children}
      </TenantFrame>
    </TenantContext>
  );
}
