import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type {
  OnboardingAnswer,
  OnboardingFocus,
  OnboardingItemName,
  OnboardingRegion,
  OnboardingRole,
} from "@/components/programs/onboarding/options";

export type OnboardingProfile = FunctionReturnType<
  typeof api.onboarding.queries.getStatus
>["profile"];

export interface OnboardingAnswers {
  readonly focus?: OnboardingFocus;
  readonly region?: OnboardingRegion;
  readonly role?: OnboardingRole;
}

/** Initializes controlled questionnaire answers from a resumable profile. */
export function getOnboardingAnswers(
  profile: OnboardingProfile
): OnboardingAnswers {
  return profile
    ? {
        ...(profile.focus ? { focus: profile.focus } : {}),
        ...(profile.region ? { region: profile.region } : {}),
        ...(profile.role ? { role: profile.role } : {}),
      }
    : {};
}

/** Opens the first unanswered question, or the focus step for a complete draft. */
export function getInitialOnboardingItem(
  answers: OnboardingAnswers
): OnboardingItemName {
  if (!answers.role) {
    return "role";
  }
  if (!answers.region) {
    return "region";
  }
  return "focus";
}

/** Converts one controlled answer into the public Convex mutation union. */
export function getOnboardingAnswer(
  item: OnboardingItemName,
  answers: OnboardingAnswers
): OnboardingAnswer | null {
  if (item === "role") {
    return answers.role ? { kind: "role", value: answers.role } : null;
  }

  if (item === "region") {
    return answers.region ? { kind: "region", value: answers.region } : null;
  }

  return answers.focus ? { kind: "focus", value: answers.focus } : null;
}

/** Returns all three answers only when the draft is ready for Finish. */
export function getCompleteOnboardingAnswers(answers: OnboardingAnswers) {
  if (!(answers.role && answers.region && answers.focus)) {
    return null;
  }
  return {
    focus: answers.focus,
    region: answers.region,
    role: answers.role,
  };
}

/** Applies one optimistic answer to the cached public profile shape. */
export function applyOnboardingAnswer(
  profile: OnboardingProfile,
  answer: OnboardingAnswer,
  updatedAt: number
): NonNullable<OnboardingProfile> {
  const base = profile ?? { updatedAt };
  if (answer.kind === "role") {
    return { ...base, role: answer.value, updatedAt };
  }

  if (answer.kind === "region") {
    return { ...base, region: answer.value, updatedAt };
  }

  return { ...base, focus: answer.value, updatedAt };
}
