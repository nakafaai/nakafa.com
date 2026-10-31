import { Id } from "@repo/backend/confect/_generated/id";
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

/** The version a school gives its impact assessment, and who reviewed it: one line, 1 to 120 characters. */
const DpiaText = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxLength(120)
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
  personId: Id("tenantPeople"),
  possible: Schema.Finite,
  rating: Schema.Finite,
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
});

/** A school's impact assessment on record, which switches Insight on (ADR 0035). */
export const insightDpiaValidator = Schema.Struct({
  recordedAt: Schema.Finite,
  recordedBy: Id("tenantPeople"),
  reviewer: DpiaText,
  tenantId: Id("tenants"),
  version: DpiaText,
});

/** What a teacher says about a student, sealed with the school key, and when it was shared with the student's guardians. */
export const insightNarrativeValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  personId: Id("tenantPeople"),
  sealedText: Sealed,
  sharedAt: Schema.optionalKey(Schema.Finite),
  tenantId: Id("tenants"),
  updatedAt: Schema.Finite,
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

/** One competency of one student as a teacher sees it, with the chance of reaching the KKTP. */
export const TeacherSkillView = Schema.Struct({
  ...SkillView.fields,
  chance: Schema.Finite,
});

/** One student of a class as a teacher sees it. */
export const StudentInsight = Schema.Struct({
  id: Id("tenantPeople"),
  name: Schema.String,
  narrative: Schema.NullOr(
    Schema.Struct({ shared: Schema.Boolean, text: Schema.String })
  ),
  skills: Schema.Array(TeacherSkillView),
});

/** A class's Insight: the KKTP its chances are counted against, and its students. */
export const ClassInsight = Schema.Struct({
  kktp: Schema.Finite,
  students: Schema.Array(StudentInsight),
});

/** The questions of an exam in order, with the competency each one tells of. */
export const QuestionTag = Schema.Struct({
  competency: Schema.NullOr(Competency),
  id: Id("examQuestions"),
  number: Schema.Int,
});

/** A school's impact assessment as Settings shows it. */
export const DpiaView = Schema.Struct({
  recordedAt: Schema.Finite,
  reviewer: DpiaText,
  version: DpiaText,
});

/** The fields a school records its impact assessment with. */
export const DpiaFields = {
  reviewer: DpiaText,
  version: DpiaText,
};
