import {
  AiChat02Icon,
  Books02Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import type { Locale } from "next-intl";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";

export const forYouNavigationItems = {
  subject: {
    href: "/curriculum",
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
 * Returns the primary sidebar and home actions.
 *
 * One list serves every audience; only each resolved destination follows the
 * learner's stored preferences.
 */
export function getForYouNavigationItems() {
  return primaryNavigationItems;
}

/** Resolves the locale-aware destination for one personalized navigation row. */
export function getForYouNavigationHref(
  item: ForYouNavigationItem,
  locale: Locale,
  preferences: {
    preferredCurriculumHref?: string | null;
    preferredTryoutHref?: string | null;
  } = {}
) {
  if (item.id === "subject" && preferences.preferredCurriculumHref) {
    return preferences.preferredCurriculumHref;
  }

  if (item.id === "subject") {
    return getCurriculumIndexHref(locale);
  }

  if (item.id === "tryOut" && preferences.preferredTryoutHref) {
    return preferences.preferredTryoutHref;
  }

  return item.href;
}
