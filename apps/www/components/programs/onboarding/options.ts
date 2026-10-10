import type { Ref } from "@confect/core";
import {
  BookOpen02Icon,
  Globe02Icon,
  Quiz03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import {
  onboardingFocuses,
  onboardingRegions,
} from "@repo/backend/confect/onboarding/values";
import { selfSelectableUserRoles } from "@repo/backend/confect/users/roles";
import { Array as Arr } from "effect";

import type { RegionCountryCode } from "@/components/shared/flag";
import { roleIconByValue } from "@/lib/data/roles";

export type OnboardingAnswer = Ref.Args<
  typeof onboarding.mutations.saveAnswer
>["answer"];
type OnboardingRole = Extract<OnboardingAnswer, { kind: "role" }>["value"];
type OnboardingRegion = Extract<OnboardingAnswer, { kind: "region" }>["value"];
type OnboardingFocus = Extract<OnboardingAnswer, { kind: "focus" }>["value"];
export type OnboardingItemName = OnboardingAnswer["kind"];

interface OnboardingOption<Value extends string> {
  readonly countryCode?: RegionCountryCode;
  readonly descriptionKey?: string;
  readonly icon?: IconSvgElement;
  readonly titleKey: string;
  readonly value: Value;
}

const roleMetadata = {
  parent: {
    descriptionKey: "onboarding.role.parent.description",
    icon: roleIconByValue.parent,
    titleKey: "onboarding.role.parent.title",
  },
  student: {
    descriptionKey: "onboarding.role.student.description",
    icon: roleIconByValue.student,
    titleKey: "onboarding.role.student.title",
  },
  teacher: {
    descriptionKey: "onboarding.role.teacher.description",
    icon: roleIconByValue.teacher,
    titleKey: "onboarding.role.teacher.title",
  },
} as const satisfies Record<
  OnboardingRole,
  Omit<OnboardingOption<OnboardingRole>, "value">
>;

const regionMetadata = {
  germany: {
    countryCode: "DE",
    titleKey: "onboarding.region.germany.title",
  },
  indonesia: {
    countryCode: "ID",
    titleKey: "onboarding.region.indonesia.title",
  },
  international: {
    icon: Globe02Icon,
    titleKey: "onboarding.region.international.title",
  },
  singapore: {
    countryCode: "SG",
    titleKey: "onboarding.region.singapore.title",
  },
  "united-kingdom": {
    countryCode: "GB",
    titleKey: "onboarding.region.united-kingdom.title",
  },
  "united-states": {
    countryCode: "US",
    titleKey: "onboarding.region.united-states.title",
  },
} as const satisfies Record<
  OnboardingRegion,
  Omit<OnboardingOption<OnboardingRegion>, "value">
>;

const focusMetadata = {
  learning: {
    descriptionKey: "onboarding.focus.learning.description",
    icon: BookOpen02Icon,
    titleKey: "onboarding.focus.learning.title",
  },
  tryout: {
    descriptionKey: "onboarding.focus.tryout.description",
    icon: Quiz03Icon,
    titleKey: "onboarding.focus.tryout.title",
  },
} as const satisfies Record<
  OnboardingFocus,
  Omit<OnboardingOption<OnboardingFocus>, "value">
>;

export const roleOptions = Arr.map(selfSelectableUserRoles, (value) => ({
  ...roleMetadata[value],
  value,
}));

export const regionOptions = Arr.map(onboardingRegions, (value) => ({
  ...regionMetadata[value],
  value,
}));

export const focusOptions = Arr.map(onboardingFocuses, (value) => ({
  ...focusMetadata[value],
  value,
}));

/** Stable ordered item definitions consumed by the shadcn Questionnaire root. */
export const onboardingItems = [
  {
    choices: Arr.map(roleOptions, ({ value }) => ({ value })),
    name: "role",
    required: true,
  },
  {
    choices: Arr.map(regionOptions, ({ value }) => ({ value })),
    name: "region",
    required: true,
  },
  {
    choices: Arr.map(focusOptions, ({ value }) => ({ value })),
    name: "focus",
    required: true,
  },
] as const;

/** Narrows Questionnaire's string item callback to the owned three-step flow. */
export function isOnboardingItemName(
  value: string
): value is OnboardingItemName {
  return Arr.some(onboardingItems, (item) => item.name === value);
}
