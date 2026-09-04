import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  OnboardingFocus,
  OnboardingRegion,
} from "@repo/backend/convex/onboarding/schema";
import {
  isSelfSelectableUserRole,
  type SelfSelectableUserRole,
} from "@repo/backend/convex/users/roles";

type OnboardingProfile = Doc<"onboardingProfiles">;

/** Projects one private database row into the public draft shape. */
export function toOnboardingProfile(profile: {
  readonly completedAt?: number;
  readonly focus?: OnboardingFocus;
  readonly region?: OnboardingRegion;
  readonly role?: SelfSelectableUserRole;
  readonly updatedAt: number;
}) {
  return {
    ...(profile.completedAt === undefined
      ? {}
      : { completedAt: profile.completedAt }),
    ...(profile.focus === undefined ? {} : { focus: profile.focus }),
    ...(profile.region === undefined ? {} : { region: profile.region }),
    ...(profile.role === undefined ? {} : { role: profile.role }),
    updatedAt: profile.updatedAt,
  };
}

/** Derives the canonical public onboarding state for one active app user. */
export function toOnboardingStatus(
  user: Pick<Doc<"users">, "role">,
  profile: OnboardingProfile | null
) {
  const maySelfSelectRole =
    user.role === undefined || isSelfSelectableUserRole(user.role);
  return {
    isAuthenticated: true as const,
    isRequired: maySelfSelectRole && profile?.completedAt === undefined,
    profile: profile ? toOnboardingProfile(profile) : null,
  };
}
