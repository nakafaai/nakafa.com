import {
  AiChat02Icon,
  AllahIcon,
  BookOpen02Icon,
  Books02Icon,
  Diamond02Icon,
  Home01Icon,
  Login03Icon,
  PlusSignIcon,
  School01Icon,
  Target01Icon,
} from "@hugeicons/core-free-icons";
import { Array as Arr } from "effect";
import { SCHOOL_FEATURES } from "@/components/marketing/school/features/list";
import type { LinkTarget } from "@/lib/routing/link";
import {
  ARTICLES_TARGET,
  CURRICULA_TARGET,
  LANDING_TARGET,
  PRICING_TARGET,
  QURAN_TARGET,
  SCHOOL_ENTER_TARGET,
  SCHOOL_PRICING_TARGET,
  SCHOOL_START_TARGET,
  SCHOOL_TARGET,
  TRYOUT_TARGET,
} from "@/lib/routing/target";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/**
 * The two sections of the marketing header, one per product: the learner's
 * Nakafa and Nakafa School. Each holds the same two groups: what the product
 * holds, then Start, whose first link opens the product's own landing, so a
 * visitor reaches either landing from any page. Every link has the icon that
 * the app draws for its page and a label from the dictionary. The School
 * features open their section of the School landing.
 */
export const HEADER_SECTIONS = [
  {
    groups: [
      {
        label: "Common.explore",
        links: [
          {
            icon: Books02Icon,
            label: "Common.subject",
            target: CURRICULA_TARGET,
          },
          {
            icon: Target01Icon,
            label: "Common.try-out",
            target: TRYOUT_TARGET,
          },
          {
            icon: AiChat02Icon,
            label: "Ai.ask-nina",
            target: {
              from: LOCALE_ROUTE,
              to: "/$locale/chat",
            } satisfies LinkTarget,
          },
          {
            icon: BookOpen02Icon,
            label: "Common.articles",
            target: ARTICLES_TARGET,
          },
          { icon: AllahIcon, label: "Holy.quran", target: QURAN_TARGET },
        ],
        wide: false,
      },
      {
        label: "Marketing.start",
        links: [
          {
            icon: Home01Icon,
            label: "Marketing.learn-home",
            target: LANDING_TARGET,
          },
          {
            icon: Diamond02Icon,
            label: "Common.pricing",
            target: PRICING_TARGET,
          },
          {
            icon: Login03Icon,
            label: "Marketing.try-nakafa",
            target: {
              from: LOCALE_ROUTE,
              to: "/$locale/auth",
            } satisfies LinkTarget,
          },
        ],
        wide: false,
      },
    ],
    key: "learn",
    label: "Marketing.learn",
  },
  {
    groups: [
      {
        label: "Marketing.features",
        links: Arr.map(SCHOOL_FEATURES, (feature) => ({
          hash: feature.key,
          icon: feature.icon,
          label: `Marketing.feature.${feature.key}` as const,
          target: SCHOOL_TARGET,
        })),
        wide: true,
      },
      {
        label: "Marketing.start",
        links: [
          {
            icon: School01Icon,
            label: "Marketing.school-home",
            target: SCHOOL_TARGET,
          },
          {
            icon: Diamond02Icon,
            label: "Common.pricing",
            target: SCHOOL_PRICING_TARGET,
          },
          {
            icon: PlusSignIcon,
            label: "Common.open-school",
            target: SCHOOL_START_TARGET,
          },
          {
            icon: Login03Icon,
            label: "Marketing.school-enter",
            target: SCHOOL_ENTER_TARGET,
          },
        ],
        wide: false,
      },
    ],
    key: "school",
    label: "Common.school",
  },
] as const;

/** One section of the header, as the menu and the phone's sheet draw it. */
export type HeaderSection = (typeof HEADER_SECTIONS)[number];

/** One link of a section, which may open a part of its page. */
export type HeaderLink = HeaderSection["groups"][number]["links"][number];
