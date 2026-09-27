"use client";

import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Option } from "effect";

type CurriculumPreferenceOption = Ref.Returns<
  typeof refs.public.learningPreferences.queries.listCurriculumPrograms
>[number];

/** Return a curriculum mutation that updates the matching localized preference. */
export function useSetPreferredCurriculumMutation(
  programs: readonly CurriculumPreferenceOption[]
) {
  return useMutation(
    refs.public.learningPreferences.mutations.setPreferredCurriculum
  ).withOptimisticUpdate(
    (localStore, { locale, preferredCurriculumProgramKey }) => {
      const program = programs.find(
        (candidate) => candidate.key === preferredCurriculumProgramKey
      );
      if (!program) {
        return;
      }
      for (const query of localStore.getAllQueries(
        refs.public.learningPreferences.queries.getCurrent
      )) {
        if (query.args.locale !== locale) {
          continue;
        }
        localStore.setQuery(
          refs.public.learningPreferences.queries.getCurrent,
          query.args,
          Option.some({
            preferredCurriculumProgramKey,
            program: {
              ...(program.countryCode === undefined
                ? {}
                : {
                    countryCode: program.countryCode,
                  }),
              key: program.key,
              publicSlug: program.publicSlug,
              title: program.title,
            },
          })
        );
      }
    }
  );
}
