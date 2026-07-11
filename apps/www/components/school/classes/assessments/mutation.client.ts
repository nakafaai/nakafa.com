"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import { updateAssessmentState } from "@/components/school/classes/assessments/state";
import { reorderPage } from "@/components/school/classes/order";

function removeAssessment(
  localStore: OptimisticLocalStore,
  assessmentId: Id<"schoolAssessments">
) {
  for (const query of localStore.getAllQueries(
    api.assessments.queries.public.list.listAssessments
  )) {
    if (query.value) {
      localStore.setQuery(
        api.assessments.queries.public.list.listAssessments,
        query.args,
        {
          ...query.value,
          page: query.value.page.filter(
            (assessment) => assessment._id !== assessmentId
          ),
        }
      );
    }
  }
}

/** Return an assessment update mutation that patches every loaded list row. */
export function useUpdateAssessmentMutation() {
  return useMutation(
    api.assessments.mutations.public.update.updateAssessment
  ).withOptimisticUpdate((localStore, args) => {
    const now = Date.now();
    for (const query of localStore.getAllQueries(
      api.assessments.queries.public.list.listAssessments
    )) {
      if (!query.value) {
        continue;
      }

      localStore.setQuery(
        api.assessments.queries.public.list.listAssessments,
        query.args,
        {
          ...query.value,
          page: query.value.page.map((assessment) =>
            assessment._id === args.assessmentId
              ? updateAssessmentState(assessment, args, now)
              : assessment
          ),
        }
      );
    }
  });
}

/** Return an assessment reorder mutation for loaded adjacent rows. */
export function useReorderAssessmentMutation() {
  return useMutation(
    api.assessments.mutations.public.reorder.reorderAssessment
  ).withOptimisticUpdate((localStore, { assessmentId, direction }) => {
    for (const query of localStore.getAllQueries(
      api.assessments.queries.public.list.listAssessments
    )) {
      if (query.value) {
        localStore.setQuery(
          api.assessments.queries.public.list.listAssessments,
          query.args,
          {
            ...query.value,
            page: reorderPage(query.value.page, assessmentId, direction),
          }
        );
      }
    }
  });
}

/** Return an assessment delete mutation that removes every loaded list row. */
export function useDeleteAssessmentMutation() {
  return useMutation(
    api.assessments.mutations.public.delete.deleteAssessment
  ).withOptimisticUpdate((localStore, { assessmentId }) => {
    removeAssessment(localStore, assessmentId);
  });
}
