"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { updateAssessmentState } from "@/components/school/classes/assessments/state";
import { reorderPage } from "@/components/school/classes/order";

type UpdateAssessmentArgs = FunctionArgs<
  typeof api.assessments.mutations.public.update.updateAssessment
>;

/** Remove an assessment from every loaded class assessment page. */
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

/** Patch every loaded assessment page with one stable optimistic timestamp. */
function updateAssessmentQueries(
  localStore: OptimisticLocalStore,
  args: UpdateAssessmentArgs,
  updatedAt: number
) {
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
            ? updateAssessmentState(assessment, args, updatedAt)
            : assessment
        ),
      }
    );
  }
}

/** Return an assessment update mutation that patches every loaded list row. */
export function useUpdateAssessmentMutation() {
  const updateAssessment = useMutation(
    api.assessments.mutations.public.update.updateAssessment
  );

  return (args: UpdateAssessmentArgs) => {
    const updatedAt = Date.now();
    const optimisticMutation = updateAssessment.withOptimisticUpdate(
      (localStore, optimisticArgs) => {
        updateAssessmentQueries(localStore, optimisticArgs, updatedAt);
      }
    );

    return optimisticMutation(args);
  };
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
