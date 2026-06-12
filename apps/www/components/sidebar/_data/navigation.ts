import {
  AiChat02Icon,
  Books02Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import { userRoles } from "@repo/backend/convex/users/roles";

export const appNavigationViewers = ["guest", ...userRoles] as const;

export type AppNavigationViewer = (typeof appNavigationViewers)[number];

export const forYouNavigationItems = {
  subject: {
    href: "/subject",
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

const studentNavigationItems = [
  forYouNavigationItems.subject,
  forYouNavigationItems.tryOut,
  forYouNavigationItems.askNina,
] as const;

const generalNavigationItems = [
  forYouNavigationItems.subject,
  forYouNavigationItems.askNina,
] as const;

/**
 * Resolves the navigation audience from the persisted app role.
 */
export function getAppNavigationViewer(role: AppNavigationViewer | null) {
  if (role) {
    return role;
  }

  return "guest";
}

/**
 * Returns the primary sidebar/home actions for one navigation audience.
 */
export function getForYouNavigationItems(viewer: AppNavigationViewer) {
  if (viewer === "guest" || viewer === "student") {
    return studentNavigationItems;
  }

  return generalNavigationItems;
}
