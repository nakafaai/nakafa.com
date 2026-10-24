import {
  AiChat02Icon,
  Books02Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import {
  type LinkTarget,
  LOCALE_ROUTE,
} from "@repo/internationalization/src/link";
import { linkOptions } from "@tanstack/react-router";

const forYouNavigationItems = {
  subject: {
    icon: Books02Icon,
    id: "subject",
    labelKey: "subject",
    labelNamespace: "Common",
    target: linkOptions({ from: LOCALE_ROUTE, to: "/$locale/curricula" }),
  },
  tryOut: {
    icon: Target01Icon,
    id: "tryOut",
    labelKey: "try-out",
    labelNamespace: "Common",
    target: linkOptions({ from: LOCALE_ROUTE, to: "/$locale/try-out" }),
  },
  askNina: {
    icon: AiChat02Icon,
    id: "askNina",
    labelKey: "ask-nina",
    labelNamespace: "Ai",
    target: linkOptions({ from: LOCALE_ROUTE, to: "/$locale/chat" }),
  },
} as const;

type ForYouNavigationItem =
  (typeof forYouNavigationItems)[keyof typeof forYouNavigationItems];

const primaryNavigationItems = [
  forYouNavigationItems.subject,
  forYouNavigationItems.tryOut,
  forYouNavigationItems.askNina,
] as const;

/**
 * Returns the primary sidebar and home actions.
 *
 * One list serves every audience; only each resolved destination follows the
 * learner's stored preferences.
 */
export function getForYouNavigationItems() {
  return primaryNavigationItems;
}

/**
 * Resolves the destination of one personalized navigation row. A learner's
 * stored curriculum or try-out target replaces the row's own route on the row
 * that it names; otherwise the row's own route is returned.
 */
export function getForYouNavigationTarget(
  item: ForYouNavigationItem,
  preferences: {
    preferredCurriculumTarget?: LinkTarget | null;
    preferredTryoutTarget?: LinkTarget | null;
  } = {}
): LinkTarget {
  if (item.id === "subject" && preferences.preferredCurriculumTarget) {
    return preferences.preferredCurriculumTarget;
  }

  if (item.id === "tryOut" && preferences.preferredTryoutTarget) {
    return preferences.preferredTryoutTarget;
  }

  return item.target;
}
