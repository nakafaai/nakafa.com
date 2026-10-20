import "@tanstack/react-start/server-only";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Effect } from "effect";
import { dashboardArgs } from "@/components/exams/sitting/change";
import { readRequired } from "@/lib/data/read.server";
import type {
  ExamInput,
  ExamListInput,
  ExamRoomsInput,
  ResultsInput,
  SittingInput,
} from "@/lib/tenant/exams";
import { memberHandler } from "@/lib/tenant/member.server";

/**
 * The first page of the exam list, with the page's end. A refusal of the list
 * ends the page as not found.
 */
export const examListHandler = memberHandler(
  ({ numItems, slug }: typeof ExamListInput.Type, token: string) =>
    Effect.gen(function* () {
      const page = yield* readRequired(
        exams.exams.list,
        { paginationOpts: { cursor: null, numItems }, slug },
        token
      );
      return { isDone: page.isDone, page: page.page };
    })
);

/** The summary of an exam and the first page of its rooms, in one bounded call. */
export const examRoomsHandler = memberHandler(
  ({ examId, numItems, slug }: typeof ExamRoomsInput.Type, token: string) =>
    Effect.gen(function* () {
      const [summary, rooms] = yield* Effect.all(
        [
          readRequired(exams.rooms.exam, { examId, slug }, token),
          readRequired(
            exams.rooms.list,
            { examId, paginationOpts: { cursor: null, numItems }, slug },
            token
          ),
        ],
        { concurrency: "unbounded" }
      );
      return {
        rooms: { isDone: rooms.isDone, page: rooms.page },
        summary,
      };
    })
);

/** The exam as its editor and its try open it. */
export const examOpenHandler = memberHandler(
  ({ examId, slug }: typeof ExamInput.Type, token: string) =>
    readRequired(exams.exams.open, { examId, slug }, token)
);

/** The proctor's dashboard of one sitting, its first page of seats. */
export const sittingDashboardHandler = memberHandler(
  ({ sittingId, slug }: typeof SittingInput.Type, token: string) =>
    readRequired(
      exams.sittings.dashboard,
      dashboardArgs({ sittingId, slug }, null),
      token
    )
);

/** The student's screen of one sitting. */
export const studentSittingHandler = memberHandler(
  ({ sittingId, slug }: typeof SittingInput.Type, token: string) =>
    readRequired(exams.sittings.student, { sittingId, slug }, token)
);

/** The overview of one sitting's results, with the first page of its students, in one bounded call. */
export const resultsHandler = memberHandler(
  ({ numItems, sittingId, slug }: typeof ResultsInput.Type, token: string) =>
    Effect.gen(function* () {
      const [overview, students] = yield* Effect.all(
        [
          readRequired(
            exams.results.results.overview,
            { sittingId, slug },
            token
          ),
          readRequired(
            exams.results.results.byStudent,
            { paginationOpts: { cursor: null, numItems }, sittingId, slug },
            token
          ),
        ],
        { concurrency: "unbounded" }
      );
      return {
        overview,
        students: { isDone: students.isDone, page: students.page },
      };
    })
);
