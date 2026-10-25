import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The rows a list asks for on its first page: at least one, and at most one hundred. */
const PageSize = Schema.Int.check(
  Schema.isBetween({ maximum: 100, minimum: 1 })
);

/** The first page of the school's exams, newest first. */
export const ExamListInput = Schema.Struct({
  numItems: PageSize,
  slug: TenantSlug,
});

/** The exam and the first page of its rooms. */
export const ExamRoomsInput = Schema.Struct({
  examId: Id("exams"),
  numItems: PageSize,
  slug: TenantSlug,
});

/** One exam of the school, for its editor and for its try. */
export const ExamInput = Schema.Struct({
  examId: Id("exams"),
  slug: TenantSlug,
});

/** One sitting of an exam: the proctor's dashboard and the student's screen read it. */
export const SittingInput = Schema.Struct({
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/** The overview of one sitting's results and the first page of its students. */
export const ResultsInput = Schema.Struct({
  numItems: PageSize,
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});

/** How many exams the list asks for each time its end comes into view. The loader and the list read the same size. */
export const EXAM_PAGE_SIZE = 20;
