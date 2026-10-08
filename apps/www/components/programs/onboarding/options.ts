import type { Ref } from "@confect/core";
import {
  BookOpen02Icon,
  Globe02Icon,
  Quiz03Icon,
} from "@hugeicons/core-free-icons";
import type refs from "@repo/backend/confect/_generated/refs";
import {
  onboardingFocuses,
  onboardingRegions,
} from "@repo/backend/confect/onboarding/values";
import { selfSelectableUserRoles } from "@repo/backend/confect/users/roles";
import { Schema } from "effect";

import { roleIconByValue } from "@/lib/data/roles";

export type OnboardingAnswer = Ref.Args<
  typeof refs.public.onboarding.mutations.saveAnswer
>["answer"];
type OnboardingRole = Extract<OnboardingAnswer, { kind: "role" }>["value"];
export type OnboardingRegion = Extract<
  OnboardingAnswer,
  { kind: "region" }
>["value"];
export type OnboardingFocus = Extract<
  OnboardingAnswer,
  { kind: "focus" }
>["value"];
export type OnboardingItemName = OnboardingAnswer["kind"];

/** One hugeicons icon: its SVG elements, each a tag with its attributes. */
const IconSvgElementSchema = Schema.Array(
  Schema.Tuple([
    Schema.String,
    Schema.Record(Schema.String, Schema.Union([Schema.String, Schema.Finite])),
  ])
);

/** The display metadata of one onboarding choice, before its value is added. */
const OnboardingOptionMetadataSchema = Schema.Struct({
  countryCode: Schema.optionalKey(Schema.String),
  descriptionKey: Schema.optionalKey(Schema.String),
  icon: Schema.optionalKey(IconSvgElementSchema),
  titleKey: Schema.String,
});

type OnboardingOptionMetadata = typeof OnboardingOptionMetadataSchema.Type;

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
} as const satisfies Record<OnboardingRole, OnboardingOptionMetadata>;

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
} as const satisfies Record<OnboardingRegion, OnboardingOptionMetadata>;

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
} as const satisfies Record<OnboardingFocus, OnboardingOptionMetadata>;

export const roleOptions = selfSelectableUserRoles.map((value) => ({
  ...roleMetadata[value],
  value,
}));

export const regionOptions = onboardingRegions.map((value) => ({
  ...regionMetadata[value],
  value,
}));

export const focusOptions = onboardingFocuses.map((value) => ({
  ...focusMetadata[value],
  value,
}));

/** Stable ordered item definitions consumed by the shadcn Questionnaire root. */
export const onboardingItems = [
  {
    choices: roleOptions.map(({ value }) => ({ value })),
    name: "role",
    required: true,
  },
  {
    choices: regionOptions.map(({ value }) => ({ value })),
    name: "region",
    required: true,
  },
  {
    choices: focusOptions.map(({ value }) => ({ value })),
    name: "focus",
    required: true,
  },
] as const;

/** Narrows Questionnaire's string item callback to the owned three-step flow. */
export function isOnboardingItemName(
  value: string
): value is OnboardingItemName {
  return onboardingItems.some((item) => item.name === value);
}
