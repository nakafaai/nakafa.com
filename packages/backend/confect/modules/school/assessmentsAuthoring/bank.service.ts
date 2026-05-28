import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import { requireRichContentSize } from "@repo/backend/confect/modules/school/assessments.shared";
import {
  loadActiveClass,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Clock, Effect } from "effect";

/** Creates a question bank. */
export const createQuestionBank = Effect.fn("assessments.createQuestionBank")(
  function* (args: {
    readonly classId?: Id<"schoolClasses">;
    readonly description?: Doc<"schoolAssessmentQuestionBanks">["description"];
    readonly schoolId: Id<"schools">;
    readonly scope: Doc<"schoolAssessmentQuestionBanks">["scope"];
    readonly title: string;
  }) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAppUser();

    if (args.scope === "class" && !args.classId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "CLASS_NOT_FOUND",
          message: "Class banks require a class.",
        })
      );
    }

    if (args.scope === "school" && args.classId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "INVALID_QUESTION_BANK_SCOPE",
          message: "School banks cannot be scoped to a class.",
        })
      );
    }

    const classData = args.classId
      ? yield* loadActiveClass(args.classId)
      : null;

    if (classData && classData.schoolId !== args.schoolId) {
      return yield* Effect.fail(
        new AssessmentError({
          code: "CLASS_NOT_FOUND",
          message: "Class not found in this school.",
        })
      );
    }

    yield* requirePermission(PERMISSIONS.ASSESSMENT_CREATE, {
      classId: classData?._id,
      schoolId: args.schoolId,
      userId: user.appUser._id,
    });

    if (args.description) {
      yield* requireRichContentSize(
        args.description,
        "Question bank description"
      );
    }

    const now = yield* Clock.currentTimeMillis;

    return yield* writer.table("schoolAssessmentQuestionBanks").insert({
      classId: classData?._id,
      createdBy: user.appUser._id,
      description: args.description,
      schoolId: args.schoolId,
      scope: args.scope,
      title: args.title,
      updatedAt: now,
      updatedBy: user.appUser._id,
    });
  }
);

/** Creates a reusable question bank entry. */
export const createQuestionBankEntry = Effect.fn(
  "assessments.createQuestionBankEntry"
)(function* (args: {
  readonly bankId: Id<"schoolAssessmentQuestionBanks">;
  readonly classId?: Id<"schoolClasses">;
  readonly explanation?: Doc<"schoolAssessmentQuestionBankEntries">["explanation"];
  readonly maxSelectionCount?: number;
  readonly points: number;
  readonly questionType: Doc<"schoolAssessmentQuestionBankEntries">["questionType"];
  readonly schoolId: Id<"schools">;
  readonly shuffleChoices: boolean;
  readonly stem: Doc<"schoolAssessmentQuestionBankEntries">["stem"];
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();
  const classData = args.classId ? yield* loadActiveClass(args.classId) : null;

  if (classData && classData.schoolId !== args.schoolId) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found in this school.",
      })
    );
  }

  const bank = yield* reader
    .table("schoolAssessmentQuestionBanks")
    .get(args.bankId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!bank || bank.schoolId !== args.schoolId) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "QUESTION_BANK_NOT_FOUND",
        message: "Question bank not found in this school.",
      })
    );
  }

  if (bank.classId !== classData?._id) {
    return yield* Effect.fail(
      new AssessmentError({
        code: "QUESTION_BANK_NOT_FOUND",
        message: "Question bank not found for this class scope.",
      })
    );
  }

  yield* requirePermission(PERMISSIONS.ASSESSMENT_CREATE, {
    classId: bank.classId,
    schoolId: bank.schoolId,
    userId: user.appUser._id,
  });
  yield* requireRichContentSize(args.stem, "Question bank stem");

  if (args.explanation) {
    yield* requireRichContentSize(
      args.explanation,
      "Question bank explanation"
    );
  }

  const now = yield* Clock.currentTimeMillis;

  return yield* writer.table("schoolAssessmentQuestionBankEntries").insert({
    bankId: bank._id,
    classId: bank.classId,
    createdBy: user.appUser._id,
    explanation: args.explanation,
    maxSelectionCount: args.maxSelectionCount,
    points: args.points,
    questionType: args.questionType,
    schoolId: bank.schoolId,
    shuffleChoices: args.shuffleChoices,
    source: "manual",
    stem: args.stem,
    updatedAt: now,
    updatedBy: user.appUser._id,
  });
});
