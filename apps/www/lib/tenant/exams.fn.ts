import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import {
  ExamInput,
  ExamListInput,
  ExamRoomsInput,
  examListHandler,
  examOpenHandler,
  examRoomsHandler,
  ResultsInput,
  resultsHandler,
  SittingInput,
  sittingDashboardHandler,
  studentSittingHandler,
} from "@/lib/tenant/exams.server";

/** The first page of the school's exams, which the exam list's loader calls. */
export const readExamListFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamListInput))
  .handler(examListHandler);

/** The summary and the first page of rooms of one exam, which the rooms page's loader calls. */
export const readExamRoomsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamRoomsInput))
  .handler(examRoomsHandler);

/** One exam as its editor and its try open it, which their loaders call. */
export const readExamFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ExamInput))
  .handler(examOpenHandler);

/** The proctor's dashboard of one sitting, which the dashboard's loader calls. */
export const readSittingDashboardFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SittingInput))
  .handler(sittingDashboardHandler);

/** The student's screen of one sitting, which the student's loader calls. */
export const readStudentSittingFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SittingInput))
  .handler(studentSittingHandler);

/** The overview of one sitting's results and the first page of its students, which the results loader calls. */
export const readResultsFn = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ResultsInput))
  .handler(resultsHandler);
