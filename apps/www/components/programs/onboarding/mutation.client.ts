"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import {
  applyOnboardingAnswer,
  type OnboardingProfile,
} from "@/components/programs/onboarding/state";

/** Returns a draft mutation that updates the subscribed profile immediately. */
export function useSaveOnboardingAnswerMutation(
  initialProfile: OnboardingProfile
) {
  return useMutation(api.onboarding.mutations.saveAnswer).withOptimisticUpdate(
    (localStore, { answer }) => {
      const subscribed = localStore.getQuery(
        api.onboarding.queries.getStatus,
        {}
      );
      if (subscribed?.isAuthenticated === false) {
        return;
      }

      const current = subscribed ?? {
        isAuthenticated: true as const,
        isRequired: true,
        profile: initialProfile,
      };
      localStore.setQuery(
        api.onboarding.queries.getStatus,
        {},
        {
          ...current,
          profile: applyOnboardingAnswer(
            current.profile,
            answer,
            current.profile?.updatedAt ?? initialProfile?.updatedAt ?? 0
          ),
        }
      );
    }
  );
}
