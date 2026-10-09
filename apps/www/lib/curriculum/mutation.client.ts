"use client";

import type { Ref } from "@confect/core";
import { useMutation } from "@confect/react";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import { Option } from "effect";

type CurriculumPreferenceOption = Ref.Returns<
  typeof learningPreferences.queries.listCurriculumPrograms
>[number];

/** Return a curriculum mutation that updates the matching localized preference. */
export function useSetPreferredCurriculumMutation(
  programs: readonly CurriculumPreferenceOption[]
) {
  return useMutation(
    learningPreferences.mutations.setPreferredCurriculum
  ).withOptimisticUpdate(
    (localStore, { locale, preferredCurriculumProgramKey }) => {
      const program = programs.find(
        (candidate) => candidate.key === preferredCurriculumProgramKey
      );
      if (!program) {
        return;
      }
      for (const query of localStore.getAllQueries(
        learningPreferences.queries.getCurrent
      )) {
        if (query.args.locale !== locale) {
          continue;
        }
        localStore.setQuery(
          learningPreferences.queries.getCurrent,
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
