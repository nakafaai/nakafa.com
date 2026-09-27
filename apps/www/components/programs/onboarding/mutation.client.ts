"use client";

import { useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Option } from "effect";
import {
  applyOnboardingAnswer,
  type OnboardingProfile,
} from "@/components/programs/onboarding/state";

/** Returns a draft mutation that updates the subscribed profile immediately. */
export function useSaveOnboardingAnswerMutation(
  initialProfile: OnboardingProfile
) {
  return useMutation(
    refs.public.onboarding.mutations.saveAnswer
  ).withOptimisticUpdate((localStore, { answer }) => {
    const subscribed = Option.getOrUndefined(
      localStore.getQuery(refs.public.onboarding.queries.getStatus, {})
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
      refs.public.onboarding.queries.getStatus,
      {},
      Option.some({
        ...current,
        profile: applyOnboardingAnswer(
          current.profile,
          answer,
          current.profile?.updatedAt ?? initialProfile?.updatedAt ?? 0
        ),
      })
    );
  });
}
