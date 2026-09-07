"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";

type CurriculumPreferenceOption = FunctionReturnType<
  typeof api.learningPreferences.queries.listCurriculumPrograms
>[number];

/** Return a curriculum mutation that updates the matching localized preference. */
export function useSetPreferredCurriculumMutation(
  programs: readonly CurriculumPreferenceOption[]
) {
  return useMutation(
    api.learningPreferences.mutations.setPreferredCurriculum
  ).withOptimisticUpdate(
    (localStore, { locale, preferredCurriculumProgramKey }) => {
      const program = programs.find(
        (candidate) => candidate.key === preferredCurriculumProgramKey
      );
      if (!program) {
        return;
      }

      for (const query of localStore.getAllQueries(
        api.learningPreferences.queries.getCurrent
      )) {
        if (query.args.locale !== locale) {
          continue;
        }

        localStore.setQuery(
          api.learningPreferences.queries.getCurrent,
          query.args,
          {
            preferredCurriculumProgramKey,
            program: {
              countryCode: program.countryCode,
              key: program.key,
              publicSlug: program.publicSlug,
              title: program.title,
            },
          }
        );
      }
    }
  );
}
