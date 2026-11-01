import {
  Notification01Icon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { photoOf } from "@repo/backend/confect/users/picture";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { lazy } from "@repo/design-system/lib/lazy";
import { toast } from "@repo/design-system/lib/toast/notify";
import { localizeInternalHref } from "@repo/internationalization/src/href";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Result } from "effect";
import { Suspense, useEffect } from "react";
import { useTranslations } from "use-intl";
import { clearAiDraftText } from "@/components/ai/store/draft";
import { AnalyticsConsentMenuItem } from "@/components/analytics/consent/menu";
import { useLiveSession } from "@/components/providers/live";
import { AccountMenu } from "@/components/sidebar/menu/account";
import {
  CommunityMenuItem,
  LearnMoreSubmenu,
  LegalMenuItems,
  NakafaAboutMenuItem,
} from "@/components/sidebar/menu/learn";
import {
  SidebarLanguageSubmenu,
  SidebarThemeSubmenu,
} from "@/components/sidebar/menu/preference";
import {
  SidebarKnownSchoolItems,
  SidebarSchools,
} from "@/components/sidebar/menu/schools";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
import type { CurrentUser } from "@/lib/identity/client";
import { saveKnownAccount } from "@/lib/identity/known";
import { profileTarget } from "@/lib/profile/href";
import { useCurrentLocale } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/**
 * The account's live schools, loaded when the menu warms: the list brings the
 * school contracts with it, which no page needs at first paint.
 */
const SidebarMembershipItems = lazy(() =>
  import("@/components/sidebar/menu/memberships").then((module) => ({
    default: module.SidebarMembershipItems,
  }))
);

/** The second line of the account button: the account's plan. */
function usePlanLabels() {
  const t = useTranslations("Auth");
  return { free: t("plan-free"), pro: t("plan-pro") };
}

/**
 * Renders the app account menu once authentication is confirmed. Its groups are
 * the account's schools, the account's pages, then the language, the theme and the
 * Learn more menu, which holds the About and Community links, the legal pages and
 * the privacy preference. It keeps the row it shows for the next page.
 */
export function NavUserAccount({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const tNotifications = useTranslations("Notifications");
  const navigate = useNavigate();
  const locale = useCurrentLocale();
  const sessionId = useLiveSession((state) => state.sessionId);
  const { username } = user.appUser;
  const planLabelByPlan = usePlanLabels();

  useEffect(() => {
    if (sessionId !== null) {
      Effect.runSync(saveKnownAccount(sessionId, user));
    }
  }, [sessionId, user]);

  /**
   * Signs the user out, then opens the locale home as a full document load on
   * success, so the socket closes and every store resets. A failed sign-out says
   * so, because the account is still signed in.
   */
  async function handleSignOut() {
    const result = await Effect.runPromise(
      Effect.result(signOutAccountBrowserIdentity())
    );
    if (Result.isSuccess(result)) {
      Effect.runSync(clearAiDraftText);
      window.location.replace(localizeInternalHref("/", locale));
      return;
    }
    toast.error({
      description: "sign-out-error.description",
      title: "sign-out-error.title",
    });
  }

  return (
    <AccountMenu
      account={{
        email: user.authUser.email,
        mascot: user.appUser.mascot,
        photo: photoOf(user.appUser),
      }}
      description={planLabelByPlan[user.appUser.plan]}
      name={user.authUser.name}
      onSignOut={handleSignOut}
    >
      <SidebarSchools canOpenSchool={!isLoginAddress(user.authUser.email)}>
        <Suspense fallback={<SidebarKnownSchoolItems />}>
          <SidebarMembershipItems />
        </Suspense>
      </SidebarSchools>
      <DropdownMenuGroup>
        {username === undefined ? null : (
          <DropdownMenuItem onClick={() => navigate(profileTarget(username))}>
            <HugeIcons icon={UserIcon} />
            {t("profile")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() =>
            navigate({ from: LOCALE_ROUTE, to: "/$locale/notifications" })
          }
        >
          <HugeIcons icon={Notification01Icon} />
          {tNotifications("title")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            navigate({ from: LOCALE_ROUTE, to: "/$locale/user/settings" })
          }
        >
          <HugeIcons icon={Settings01Icon} />
          {t("settings")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <SidebarLanguageSubmenu />
        <SidebarThemeSubmenu />
        <LearnMoreSubmenu>
          <NakafaAboutMenuItem />
          <CommunityMenuItem />
          <LegalMenuItems />
          <AnalyticsConsentMenuItem />
        </LearnMoreSubmenu>
      </DropdownMenuGroup>
    </AccountMenu>
  );
}
