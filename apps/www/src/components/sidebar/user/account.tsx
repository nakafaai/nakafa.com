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
import { localizeInternalHref } from "@repo/internationalization/src/href";
import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { Effect, Option, Result } from "effect";
import { lazy, Suspense } from "react";
import { useTranslations } from "use-intl";
import { clearAiDraftText } from "@/components/ai/store/draft";
import { AnalyticsConsentMenuItem } from "@/components/analytics/consent/menu";
import { AccountMenu } from "@/components/sidebar/menu/account";
import { SidebarUtilityMenuItems } from "@/components/sidebar/menu/utility";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
import { usePageNavigation } from "@/lib/content/page/context";
import type { CurrentUser } from "@/lib/identity/client";
import { profileTarget } from "@/lib/profile/href";
import { useCurrentLocale } from "@/lib/routing/link";
import { publicPathTarget } from "@/lib/routing/target";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

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
  /** Opens one signed Page of the account menu inside the app. */
  function openPage(publicPath: string) {
    Option.map(publicPathTarget(publicPath), (target) => navigate(target));
  }
  const { username } = user.appUser;
  const planLabelByPlan = {
    free: t("plan-free"),
    pro: t("plan-pro"),
  };

  /** Signs the user out, then opens the locale home as a full document load on success, so the socket closes and every store resets. */
  async function handleSignOut() {
    const result = await Effect.runPromise(
      Effect.result(signOutAccountBrowserIdentity())
    );
    if (Result.isSuccess(result)) {
      Effect.runSync(clearAiDraftText);
      window.location.replace(localizeInternalHref("/", locale));
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
            onClick={() => navigate(profileTarget(username))}
          >
            <HugeIcons icon={UserIcon} />
            {t("profile")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() =>
            navigate({ from: LOCALE_ROUTE, to: "/$locale/notifications" })
          }
        >
          <HugeIcons icon={Notification01Icon} />
          {tNotifications("title")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() =>
            navigate({ from: LOCALE_ROUTE, to: "/$locale/user/settings" })
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
              onClick={() => openPage(pageNavigation.termsOfServicePath)}
            >
              <HugeIcons icon={FileValidationIcon} />
              {tLegal("terms-of-service")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => openPage(pageNavigation.privacyPolicyPath)}
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
