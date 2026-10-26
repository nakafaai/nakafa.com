import classroom from "@repo/backend/confect/_generated/refs/classroom";
import records from "@repo/backend/confect/_generated/refs/records";
import { Effect } from "effect";
import { readRequired } from "@/lib/data/read.server";
import type { ClassForumInput } from "@/lib/tenant/classes";
import { memberHandler } from "@/lib/tenant/member.server";

/**
 * The class, the scheme its next entry is judged by, and the first page of its gradebook:
 * the gradebook belongs to the class, so the class is read first. A class that the viewer
 * may not open, or whose grades the viewer does not keep, ends the page as not found.
 */
export const classGradesHandler = memberHandler(
  ({ classSlug, numItems, slug }: typeof ClassForumInput.Type, token: string) =>
    Effect.gen(function* () {
      const resolved = yield* readRequired(
        classroom.classes.resolve,
        { classSlug, slug },
        token
      );
      const [scheme, sheet] = yield* Effect.all(
        [
          readRequired(
            records.grades.scheme,
            { classId: resolved.id, slug },
            token
          ),
          readRequired(
            records.grades.sheet,
            {
              classId: resolved.id,
              paginationOpts: { cursor: null, numItems },
              slug,
            },
            token
          ),
        ],
        { concurrency: "unbounded" }
      );
      return {
        resolved,
        scheme,
        sheet: { isDone: sheet.isDone, page: sheet.page },
      };
    })
);
