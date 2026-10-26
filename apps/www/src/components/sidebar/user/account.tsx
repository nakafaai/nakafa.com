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
import { toast } from "@repo/design-system/lib/toast/notify";
import { localizeInternalHref } from "@repo/internationalization/src/href";
import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { Effect, Function as Fn, Option, Result } from "effect";
import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
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
import { AccountPricing } from "@/components/sidebar/menu/pricing";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
import { loadKnownSession } from "@/lib/auth/known";
import type { CurrentUser } from "@/lib/identity/client";
import {
  loadKnownAccountText,
  readKnownAccount,
  saveKnownAccount,
} from "@/lib/identity/known";
import { profileTarget } from "@/lib/profile/href";
import { useCurrentLocale } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/**
 * The account's schools, loaded when the menu warms: the list brings the school
 * contracts with it, which no page needs at first paint.
 */
const SidebarSchoolMenuItems = lazy(() =>
  import("@/components/sidebar/menu/schools").then((module) => ({
    default: module.SidebarSchoolMenuItems,
  }))
);

/** The second line of the account button: the account's plan. */
function usePlanLabels() {
  const t = useTranslations("Auth");
  return { free: t("plan-free"), pro: t("plan-pro") };
}

/** What the browser keeps under a mounted footer changes only with a new page, so nothing notifies. */
function subscribeKnown() {
  return Fn.constVoid;
}

/** The account row the browser kept, as its stored text. */
function readStoredAccount() {
  return Effect.runSync(loadKnownAccountText());
}

/** The session the browser last had. */
function readStoredSession() {
  return Effect.runSync(loadKnownSession());
}

/** The server keeps nothing for the browser. */
function readNothing() {
  return null;
}

/**
 * The account row the browser kept for the session the page holds or is about
 * to hold, drawn while the live account loads, so the footer never waits empty
 * for it. It is inert, so a press waits for the live row, which draws the same
 * row once it arrives. A session that settled on another account or on none
 * draws nothing, and so does a browser that kept no row.
 */
export function KnownAccountRow() {
  const planLabels = usePlanLabels();
  const isPending = useLiveSession((state) => state.isPending);
  const sessionId = useLiveSession((state) => state.sessionId);
  const text = useSyncExternalStore(
    subscribeKnown,
    readStoredAccount,
    readNothing
  );
  const knownSession = useSyncExternalStore(
    subscribeKnown,
    readStoredSession,
    readNothing
  );
  const account = readKnownAccount(text, isPending ? knownSession : sessionId);

  if (Option.isNone(account)) {
    return null;
  }
  const { mascot, name, photo, plan } = account.value;
  return (
    <div className="contents" inert>
      <AccountPricing plan={plan} />
      <AccountMenu
        account={{ mascot, photo }}
        description={planLabels[plan]}
        name={name}
        onSignOut={Fn.constVoid}
      >
        {null}
      </AccountMenu>
    </div>
  );
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
