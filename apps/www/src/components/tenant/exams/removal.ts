import type { OptimisticUpdate } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Array as Arr, Option } from "effect";

/**
 * Takes a deleted exam out of the store while the server deletes it: out of every page of each
 * open exam list. Convex puts it back when the server refuses the deletion.
 */
export const removeExamUpdate: OptimisticUpdate<typeof exams.exams.remove> = (
  localStore,
  args
) => {
  for (const query of localStore.getAllQueries(exams.exams.list)) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        exams.exams.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.filter(
            query.value.value.page,
            (exam) => exam.id !== args.examId
          ),
        })
      );
    }
  }
};
