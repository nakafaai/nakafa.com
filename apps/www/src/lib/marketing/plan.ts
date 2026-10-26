import {
  Award02Icon,
  BookOpen01Icon,
  Coins01Icon,
  CustomerSupportIcon,
  LibraryIcon,
  Quiz03Icon,
  SparklesIcon,
  Tick01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";

/** Free plan feature message keys, in display order. */
export const freePlanFeatures = [
  "free-feature-1",
  "free-feature-2",
  "free-feature-3",
  "free-feature-4",
  "free-feature-5",
] as const;

/** Pro feature message keys, in display order. */
export const proPlanFeatures = [
  "pro-feature-1",
  "pro-feature-2",
  "pro-feature-3",
  "pro-feature-5",
] as const;

/**
 * The icon of each plan feature, so a line reads at a glance and no two lines
 * of the plans draw the same icon. The pricing cards and the upgrade card of
 * settings both read it.
 */
export const planFeatureIcons = {
  "free-feature-1": LibraryIcon,
  "free-feature-2": Quiz03Icon,
  "free-feature-3": Coins01Icon,
  "free-feature-4": Award02Icon,
  "free-feature-5": UserMultipleIcon,
  "pro-feature-1": Tick01Icon,
  "pro-feature-2": SparklesIcon,
  "pro-feature-3": BookOpen01Icon,
  "pro-feature-5": CustomerSupportIcon,
} as const satisfies Record<
  (typeof freePlanFeatures)[number] | (typeof proPlanFeatures)[number],
  typeof Tick01Icon
>;
