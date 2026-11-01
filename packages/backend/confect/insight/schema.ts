import { Id } from "@repo/backend/confect/_generated/id";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** What a teacher calls a competency: one line, 1 to 80 characters. */
export const Competency = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(80)
);

/** What a teacher writes about a student: trimmed, 1 to 4,000 characters. */
export const NarrativeText = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(4000)
);

/** The competency a teacher names for one question of an exam. */
export const insightTagValidator = Schema.Struct({
  competency: Competency,
  examId: Id("exams"),
  questionId: Id("examQuestions"),
  tenantId: Id("tenants"),
});

/**
 * One student's standing in one competency: the rating, and the count and points behind it. One answer updates one row
 * and no history is read again (ADR 0035).
 */
export const insightMasteryValidator = Schema.Struct({
  competency: Competency,
  earned: Schema.Finite,
  observations: Schema.Int,
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  possible: Schema.Finite,
  rating: Schema.Finite,
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/** What a teacher says about a student, sealed with the school key, and when it was shared with the student's guardians. */
export const insightNarrativeValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  sealedText: Sealed,
  sharedAt: Schema.optionalKey(Schema.Finite),
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/** The forecasts the results of one sitting tested: how many, their summed squared error, and how many reached the KKTP. */
export const insightScoreValidator = Schema.Struct({
  at: Schema.Finite,
  count: Schema.Int,
  errors: Schema.Finite,
  reached: Schema.Int,
  sittingId: Id("examSittings"),
  tenantId: Id("tenants"),
});

/** One month's test of the forecast: its Brier score, the score of always answering the month's base rate, and the verdict. */
export const insightCalibrationValidator = Schema.Struct({
  baseline: Schema.Finite,
  brier: Schema.Finite,
  count: Schema.Int,
  month: Schema.String,
  passed: Schema.Boolean,
});

/** Nina's draft of a narrative: there with no text while she writes it, and gone once the teacher saves their own. */
export const insightDraftValidator = Schema.Struct({
  askedBy: Id("tenantPeople"),
  classId: Id("classes"),
  periodId: Id("tenantPeriods"),
  personId: Id("tenantPeople"),
  sealedText: Schema.optionalKey(Sealed),
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/** The sealed field of a draft, bound to its class and its student. */
export const draftField = (
  row: Pick<typeof insightDraftValidator.Type, "classId" | "personId">
) => ({
  field: "sealedText",
  row: [row.classId, row.personId],
  table: "insightDrafts",
});

/** One try-out track, the topic a student's private practice is shared by. */
export const PracticeTopic = Schema.Struct({
  countryKey: tryoutRouteKeyValidator,
  examKey: tryoutRouteKeyValidator,
  trackKey: tryoutRouteKeyValidator,
});

/** A topic of a student's private practice that they shared with their school (ADR 0012). */
export const insightShareValidator = Schema.Struct({
  ...PracticeTopic.fields,
  personId: Id("tenantPeople"),
  sharedAt: Schema.Finite,
  tenantId: Id("tenants"),
});

/** What a student's practice says of a topic: the sets they finished and their mean score. */
const PracticeView = Schema.Struct({
  ...PracticeTopic.fields,
  mean: Schema.Finite,
  sets: Schema.Int,
});

/** A topic as its student sees it, with whether they share it. */
export const OwnPracticeView = Schema.Struct({
  ...PracticeView.fields,
  shared: Schema.Boolean,
});

/** The sealed field of a narrative, bound to its class and its student. */
export const narrativeField = (
  row: Pick<typeof insightNarrativeValidator.Type, "classId" | "personId">
) => ({
  field: "sealedText",
  row: [row.classId, row.personId],
  table: "insightNarratives",
});

/** One competency of one student as a reader sees it. */
export const SkillView = Schema.Struct({
  competency: Competency,
  earned: Schema.Finite,
  observations: Schema.Int,
  possible: Schema.Finite,
  rating: Schema.Finite,
});

/** One competency of one student as a teacher sees it, with the chance of reaching the KKTP while the forecast passes its test. */
const TeacherSkillView = Schema.Struct({
  ...SkillView.fields,
  chance: Schema.NullOr(Schema.Finite),
});

/** One student of a class as a teacher sees it. */
const StudentInsight = Schema.Struct({
  draft: Schema.NullOr(Schema.Struct({ text: Schema.NullOr(Schema.String) })),
  id: Id("tenantPeople"),
  name: Schema.String,
  narrative: Schema.NullOr(
    Schema.Struct({ shared: Schema.Boolean, text: Schema.String })
  ),
  practice: Schema.Array(PracticeView),
  skills: Schema.Array(TeacherSkillView),
});

/** A class's Insight: the KKTP its chances are counted against, whether the forecast passes its test, and its students. */
export const ClassInsight = Schema.Struct({
  forecasts: Schema.Boolean,
  kktp: Schema.Finite,
  students: Schema.Array(StudentInsight),
});

/** The questions of an exam in order, with the competency each one tells of. */
export const QuestionTag = Schema.Struct({
  competency: Schema.NullOr(Competency),
  id: Id("examQuestions"),
  number: Schema.Int,
});
