import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  ExamInput,
  ExamListInput,
  ExamRoomsInput,
  ResultsInput,
  SittingInput,
  StudentSittingInput,
} from "@/lib/tenant/exams";

/** The first page of the school's exams, which the exam list's loader calls. */
export const readExamListFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamListInput))
  .handler(async (options) => {
    const { examListHandler } = await import("@/lib/tenant/exams.server");
    return examListHandler(options);
  });

/** The summary and the first page of rooms of one exam, which the rooms page's loader calls. */
export const readExamRoomsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamRoomsInput))
  .handler(async (options) => {
    const { examRoomsHandler } = await import("@/lib/tenant/exams.server");
    return examRoomsHandler(options);
  });

/** One exam as its editor and its try open it, which their loaders call. */
export const readExamFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamInput))
  .handler(async (options) => {
    const { examOpenHandler } = await import("@/lib/tenant/exams.server");
    return examOpenHandler(options);
  });

/** The proctor's dashboard of one sitting, which the dashboard's loader calls. */
export const readSittingDashboardFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SittingInput))
  .handler(async (options) => {
    const { sittingDashboardHandler } = await import(
      "@/lib/tenant/exams.server"
    );
    return sittingDashboardHandler(options);
  });

/** The student's screen of one sitting, which the student's loader calls. */
export const readStudentSittingFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(StudentSittingInput))
  .handler(async (options) => {
    const { studentSittingHandler } = await import("@/lib/tenant/exams.server");
    return studentSittingHandler(options);
  });

/** The overview of one sitting's results and the first page of its students, which the results loader calls. */
export const readResultsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ResultsInput))
  .handler(async (options) => {
    const { resultsHandler } = await import("@/lib/tenant/exams.server");
    return resultsHandler(options);
  });
