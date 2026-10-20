import {
  FileValidationIcon,
  LockIcon,
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
import {
  useCurrentLocale,
  useHrefNavigate,
} from "@repo/internationalization/src/link";
import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { Effect, Result } from "effect";
import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { clearAiDraftText } from "@/components/ai/store/draft";
import { AnalyticsConsentMenuItem } from "@/components/analytics/consent/menu";
import { AccountMenu } from "@/components/sidebar/menu/account";
import { SidebarUtilityMenuItems } from "@/components/sidebar/menu/utility";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
import { useCurrentAuthNavigation } from "@/lib/auth/location";
import { usePageNavigation } from "@/lib/content/page/context";
import type { CurrentUser } from "@/lib/identity/client";
import { profileTarget } from "@/lib/profile/href";

/**
 * The account's schools, loaded when the menu opens: the list brings the school
 * contracts with it, which no page needs at first paint.
 */
const SidebarSchoolMenuItems = lazy(() =>
  import("@/components/sidebar/menu/schools").then((module) => ({
    default: module.SidebarSchoolMenuItems,
  }))
);

/** Renders the app account menu, with the account and legal pages, once authentication is confirmed. */
export function NavUserAccount({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const tLegal = useTranslations("Legal");
  const tNotifications = useTranslations("Notifications");
  const pageNavigation = usePageNavigation((navigation) => navigation);
  const navigate = useNavigate();
  const locale = useCurrentLocale();
  const navigateToHref = useHrefNavigate();
  const authNavigation = useCurrentAuthNavigation();
  const { username } = user.appUser;
  const planLabelByPlan = {
    free: t("plan-free"),
    pro: t("plan-pro"),
  };

  /** Signs the user out and leaves the shared authenticated app subtree on success. */
  async function handleSignOut() {
    const result = await Effect.runPromise(
      Effect.result(signOutAccountBrowserIdentity())
    );
    if (Result.isSuccess(result)) {
      Effect.runSync(clearAiDraftText);
      navigate({ ...authNavigation.readTarget(), replace: true });
    }
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
      <Suspense fallback={null}>
        <ClientOnly fallback={null}>
          <SidebarSchoolMenuItems
            canOpenSchool={!isLoginAddress(user.authUser.email)}
          />
        </ClientOnly>
      </Suspense>
      <DropdownMenuGroup>
        {username === undefined ? null : (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => navigate(profileTarget(username, locale))}
          >
            <HugeIcons icon={UserIcon} />
            {t("profile")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() =>
            navigate({ params: { locale }, to: "/$locale/notifications" })
          }
        >
          <HugeIcons icon={Notification01Icon} />
          {tNotifications("title")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() =>
            navigate({ params: { locale }, to: "/$locale/user/settings" })
          }
        >
          <HugeIcons icon={Settings01Icon} />
          {t("settings")}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <SidebarUtilityMenuItems />
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {pageNavigation ? (
          <>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => navigateToHref(pageNavigation.termsOfServiceHref)}
            >
              <HugeIcons icon={FileValidationIcon} />
              {tLegal("terms-of-service")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => navigateToHref(pageNavigation.privacyPolicyHref)}
            >
              <HugeIcons icon={LockIcon} />
              {tLegal("privacy-policy")}
            </DropdownMenuItem>
          </>
        ) : null}
        <AnalyticsConsentMenuItem />
      </DropdownMenuGroup>
    </AccountMenu>
  );
}
