import type { OptimisticUpdate } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Array as Arr, Option } from "effect";
import { changeLoaded, withPage } from "@/lib/data/loaded";

/**
 * Takes a deleted exam out of the store while the server deletes it: out of every page of each
 * open exam list. Convex puts it back when the server refuses the deletion.
 */
export const removeExamUpdate: OptimisticUpdate<typeof exams.exams.remove> = (
  localStore,
  args
) => {
  changeLoaded(localStore, exams.exams.list, (value) =>
    Option.some(
      withPage(value, (page) =>
        Arr.filter(page, (exam) => exam.id !== args.examId)
      )
    )
  );
};
