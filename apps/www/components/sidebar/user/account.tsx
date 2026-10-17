"use client";

import {
  FileValidationIcon,
  LockIcon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { photoOf } from "@repo/backend/confect/users/picture";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { Effect, Result } from "effect";
import { useTranslations } from "next-intl";
import { clearAiDraftText } from "@/components/ai/store/draft";
import { AnalyticsConsentMenuItem } from "@/components/analytics/consent/actions";
import { AccountMenu } from "@/components/sidebar/menu/account";
import { SidebarUtilityMenuItems } from "@/components/sidebar/menu/utility";
import { signOutAccountBrowserIdentity } from "@/lib/auth/identity/browser";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { usePageNavigation } from "@/lib/content/page/context";
import type { CurrentUser } from "@/lib/identity/client";
import { profileHref } from "@/lib/profile/href";

/** Renders the app account menu, with the account and legal pages, once authentication is confirmed. */
export function NavUserAccount({ user }: { user: CurrentUser }) {
  const t = useTranslations("Auth");
  const tLegal = useTranslations("Legal");
  const pageNavigation = usePageNavigation((navigation) => navigation);
  const router = useRouter();
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
      router.replace(authNavigation.readHref());
    }
  }

  return (
    <AccountMenu
      account={{
        email: user.authUser.email,
        mascot: user.appUser.mascot,
        name: user.authUser.name,
        photo: photoOf(user.appUser),
      }}
      description={planLabelByPlan[user.appUser.plan]}
      name={user.authUser.name}
      onSignOut={handleSignOut}
    >
      <DropdownMenuGroup>
        {username === undefined ? null : (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => router.push(profileHref(username))}
          >
            <HugeIcons icon={UserIcon} />
            {t("profile")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/user/settings")}
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
              onClick={() => router.push(pageNavigation.termsOfServiceHref)}
            >
              <HugeIcons icon={FileValidationIcon} />
              {tLegal("terms-of-service")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push(pageNavigation.privacyPolicyHref)}
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
