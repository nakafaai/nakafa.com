import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { slugify } from "@repo/backend/confect/modules/content/contentSync.shared";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { AssessmentError } from "@repo/backend/confect/modules/school/assessments.errors";
import {
  requireAssessment,
  requireRichContentSize,
  validateScheduledStatus,
} from "@repo/backend/confect/modules/school/assessments.shared";
import {
  loadActiveClass,
  requirePermission,
} from "@repo/backend/confect/modules/school/classAccess.service";
import { PERMISSIONS } from "@repo/backend/confect/modules/school/permissions";
import { Clock, Duration, Effect, Option } from "effect";

/** Generates a unique assessment slug for a school. */
const generateUniqueAssessmentSlug = Effect.fnUntraced(function* (
  schoolId: Id<"schools">,
  baseSlug: string
) {
  const reader = yield* DatabaseReader;
  const safeBaseSlug = baseSlug || "assessment";
  let suffix = 0;

  while (true) {
    const candidateSlug =
      suffix === 0 ? safeBaseSlug : `${safeBaseSlug}-${suffix}`;
    const existing = yield* reader
      .table("schoolAssessments")
      .index("by_schoolId_and_slug", (query) =>
        query.eq("schoolId", schoolId).eq("slug", candidateSlug)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));

    if (!existing) {
      return candidateSlug;
    }

    suffix += 1;
  }
});

/** Computes the next order value for a school or class assessment list. */
const getNextAssessmentOrder = Effect.fnUntraced(function* (
  schoolId: Id<"schools">,
  classId: Id<"schoolClasses"> | undefined
) {
  const reader = yield* DatabaseReader;
  const lastAssessment = classId
    ? yield* reader
        .table("schoolAssessments")
        .index(
          "by_schoolId_and_classId_and_order",
          (query) => query.eq("schoolId", schoolId).eq("classId", classId),
          "desc"
        )
        .first()
        .pipe(Effect.map(Option.getOrNull))
    : yield* reader
        .table("schoolAssessments")
        .index(
          "by_schoolId_and_order",
          (query) => query.eq("schoolId", schoolId),
          "desc"
        )
        .first()
        .pipe(Effect.map(Option.getOrNull));

  return (lastAssessment?.order ?? -1) + 1;
});

/** Creates an editable assessment shell. */
export const createAssessment = Effect.fnUntraced(function* (args: {
  readonly classId?: Id<"schoolClasses">;
  readonly description?: Doc<"schoolAssessments">["description"];
  readonly mode: Doc<"schoolAssessments">["mode"];
  readonly scheduledAt?: number;
  readonly schoolId: Id<"schools">;
  readonly status: Doc<"schoolAssessments">["status"];
  readonly title: string;
}) {
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const user = yield* requireAppUser();
  const now = yield* Clock.currentTimeMillis;
  const classData = args.classId ? yield* loadActiveClass(args.classId) : null;

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
    yield* requireRichContentSize(args.description, "Assessment description");
  }

  yield* validateScheduledStatus(args.status, args.scheduledAt, now);

  const slug = yield* generateUniqueAssessmentSlug(
    args.schoolId,
    slugify(args.title)
  );
  const isPublished = args.status === "published";
  const isScheduled = args.status === "scheduled";
  const order = yield* getNextAssessmentOrder(args.schoolId, classData?._id);
  const assessmentId = yield* writer.table("schoolAssessments").insert({
    classId: classData?._id,
    createdBy: user.appUser._id,
    description: args.description,
    mode: args.mode,
    order,
    publishedAt: isPublished ? now : undefined,
    publishedBy: isPublished ? user.appUser._id : undefined,
    questionBankScope: classData ? "class" : "school",
    scheduledAt: isScheduled ? args.scheduledAt : undefined,
    schoolId: args.schoolId,
    slug,
    status: args.status,
    title: args.title,
    updatedAt: now,
    updatedBy: user.appUser._id,
  });

  const scheduledAt = args.scheduledAt;

  if (isScheduled && scheduledAt) {
    const scheduledJobId = yield* scheduler.runAfter(
      Duration.millis(Math.max(scheduledAt - now, 0)),
      refs.internal.assessments.mutations.internalFunctions.publishing
        .publishAssessment,
      { assessmentId, publishedBy: user.appUser._id }
    );
    yield* writer.table("schoolAssessments").patch(assessmentId, {
      scheduledJobId,
    });
  }

  return assessmentId;
});

/** Updates assessment metadata and publish scheduling. */
export const updateAssessment = Effect.fnUntraced(function* (args: {
  readonly assessmentId: Id<"schoolAssessments">;
  readonly description?: Doc<"schoolAssessments">["description"];
  readonly mode?: Doc<"schoolAssessments">["mode"];
  readonly scheduledAt?: number;
  readonly schoolId: Id<"schools">;
  readonly status?: Doc<"schoolAssessments">["status"];
  readonly title?: string;
}) {
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const user = yield* requireAppUser();
  const assessment = yield* requireAssessment(args.schoolId, args.assessmentId);
  const now = yield* Clock.currentTimeMillis;

  yield* requirePermission(PERMISSIONS.ASSESSMENT_UPDATE, {
    classId: assessment.classId,
    schoolId: assessment.schoolId,
    userId: user.appUser._id,
  });

  if (args.description) {
    yield* requireRichContentSize(args.description, "Assessment description");
  }

  const nextStatus = args.status ?? assessment.status;
  const nextScheduledAt = args.scheduledAt ?? assessment.scheduledAt;
  yield* validateScheduledStatus(nextStatus, nextScheduledAt, now);

  const wasScheduled = assessment.status === "scheduled";
  const willBeScheduled = nextStatus === "scheduled";
  const timeChanged = nextScheduledAt !== assessment.scheduledAt;
  const needsCancel = wasScheduled && (!willBeScheduled || timeChanged);
  const needsSchedule = willBeScheduled && (!wasScheduled || timeChanged);
  const isNewlyPublished =
    nextStatus === "published" && assessment.status !== "published";
  let scheduledJobId = assessment.scheduledJobId;

  if (needsCancel) {
    scheduledJobId = undefined;
  }

  if (needsSchedule && nextScheduledAt) {
    scheduledJobId = yield* scheduler.runAfter(
      Duration.millis(Math.max(nextScheduledAt - now, 0)),
      refs.internal.assessments.mutations.internalFunctions.publishing
        .publishAssessment,
      { assessmentId: args.assessmentId, publishedBy: user.appUser._id }
    );
  }

  yield* writer.table("schoolAssessments").patch(args.assessmentId, {
    description: args.description ?? assessment.description,
    mode: args.mode ?? assessment.mode,
    publishedAt: isNewlyPublished ? now : assessment.publishedAt,
    publishedBy: isNewlyPublished ? user.appUser._id : assessment.publishedBy,
    scheduledAt: willBeScheduled ? nextScheduledAt : undefined,
    scheduledJobId: willBeScheduled ? scheduledJobId : undefined,
    status: nextStatus,
    title: args.title ?? assessment.title,
    updatedAt: now,
    updatedBy: user.appUser._id,
  });

  return null;
});
