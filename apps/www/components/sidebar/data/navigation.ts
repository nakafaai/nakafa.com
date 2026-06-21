import {
  AiChat02Icon,
  Books02Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import { userRoles } from "@repo/backend/convex/users/roles";
import type { Locale } from "next-intl";

const appNavigationViewers = ["pending", "guest", ...userRoles] as const;

export type AppNavigationViewer = (typeof appNavigationViewers)[number];
export type AppNavigationRole = (typeof userRoles)[number];

export const forYouNavigationItems = {
  subject: {
    href: "/curriculum/merdeka",
    hrefs: {
      en: "/curriculum/merdeka",
      id: "/kurikulum/merdeka",
    },
    icon: Books02Icon,
    id: "subject",
    labelKey: "subject",
    labelNamespace: "Common",
  },
  tryOut: {
    href: "/try-out",
    icon: Target01Icon,
    id: "tryOut",
    labelKey: "try-out",
    labelNamespace: "Common",
  },
  askNina: {
    href: "/chat",
    icon: AiChat02Icon,
    id: "askNina",
    labelKey: "ask-nina",
    labelNamespace: "Ai",
  },
} as const;

export type ForYouNavigationItem =
  (typeof forYouNavigationItems)[keyof typeof forYouNavigationItems];

const primaryNavigationItems = [
  forYouNavigationItems.subject,
  forYouNavigationItems.tryOut,
  forYouNavigationItems.askNina,
] as const;

/**
 * Resolves the navigation audience from the auth query state and persisted app role.
 */
export function getAppNavigationViewer({
  isPending,
  role,
}: {
  isPending: boolean;
  role: AppNavigationRole | null;
}) {
  if (isPending) {
    return "pending";
  }

  if (role) {
    return role;
  }

  return "guest";
}

/**
 * Returns the primary sidebar/home actions shared by every navigation audience.
 */
export function getForYouNavigationItems(_viewer: AppNavigationViewer) {
  return primaryNavigationItems;
}

/**
 * Resolves the locale-aware destination for one personalized navigation row
 * while preserving rows that intentionally share one href across locales.
 */
export function getForYouNavigationHref(
  item: ForYouNavigationItem,
  locale: Locale
) {
  if ("hrefs" in item) {
    return item.hrefs[locale];
  }

  return item.href;
}
