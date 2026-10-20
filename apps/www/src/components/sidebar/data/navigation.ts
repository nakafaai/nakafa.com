import {
  AiChat02Icon,
  Books02Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import type { LinkTarget } from "@repo/internationalization/src/link";
import type { Locale } from "@repo/internationalization/src/locale";
import { linkOptions } from "@tanstack/react-router";

const forYouNavigationItems = {
  subject: {
    icon: Books02Icon,
    id: "subject",
    labelKey: "subject",
    labelNamespace: "Common",
    target: (locale: Locale): LinkTarget =>
      linkOptions({ params: { locale }, to: "/$locale/curricula" }),
  },
  tryOut: {
    icon: Target01Icon,
    id: "tryOut",
    labelKey: "try-out",
    labelNamespace: "Common",
    target: (locale: Locale): LinkTarget =>
      linkOptions({ params: { locale }, to: "/$locale/try-out" }),
  },
  askNina: {
    icon: AiChat02Icon,
    id: "askNina",
    labelKey: "ask-nina",
    labelNamespace: "Ai",
    target: (locale: Locale): LinkTarget =>
      linkOptions({ params: { locale }, to: "/$locale/chat" }),
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
 * stored curriculum or try-out path, a public path that the content gives, is
 * returned as it is; otherwise the row's own route is returned as a target.
 */
export function getForYouNavigationTarget(
  item: ForYouNavigationItem,
  locale: Locale,
  preferences: {
    preferredCurriculumHref?: string | null;
    preferredTryoutHref?: string | null;
  } = {}
): LinkTarget | string {
  if (item.id === "subject" && preferences.preferredCurriculumHref) {
    return preferences.preferredCurriculumHref;
  }

  if (item.id === "tryOut" && preferences.preferredTryoutHref) {
    return preferences.preferredTryoutHref;
  }

  return item.target(locale);
}
