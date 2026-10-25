import {
  AiChat02Icon,
  Books02Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";

import { Option } from "effect";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const forYouNavigationItems = {
  subject: {
    icon: Books02Icon,
    id: "subject",
    labelKey: "subject",
    labelNamespace: "Common",
    target: {
      from: LOCALE_ROUTE,
      to: "/$locale/curricula",
    } satisfies LinkTarget,
  },
  tryOut: {
    icon: Target01Icon,
    id: "tryOut",
    labelKey: "try-out",
    labelNamespace: "Common",
    target: { from: LOCALE_ROUTE, to: "/$locale/try-out" } satisfies LinkTarget,
  },
  askNina: {
    icon: AiChat02Icon,
    id: "askNina",
    labelKey: "ask-nina",
    labelNamespace: "Ai",
    target: { from: LOCALE_ROUTE, to: "/$locale/chat" } satisfies LinkTarget,
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
    preferredCurriculumTarget?: Option.Option<LinkTarget> | undefined;
    preferredTryoutTarget?: Option.Option<LinkTarget> | undefined;
  } = {}
): LinkTarget {
  if (item.id === "subject") {
    return Option.getOrElse(
      preferences.preferredCurriculumTarget ?? Option.none(),
      () => item.target
    );
  }

  if (item.id === "tryOut") {
    return Option.getOrElse(
      preferences.preferredTryoutTarget ?? Option.none(),
      () => item.target
    );
  }

  return item.target;
}
