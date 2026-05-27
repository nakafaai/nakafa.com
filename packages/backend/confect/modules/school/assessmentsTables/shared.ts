import { Schema } from "effect";

/** Supported serialized rich content formats. */
export const richContentFormatSchema = Schema.Literal("plate-v1");

export type RichContentFormat = Schema.Schema.Type<
  typeof richContentFormatSchema
>;

/** Serialized rich content payload persisted from Plate. */
export const richContentSchema = Schema.Struct({
  format: richContentFormatSchema,
  json: Schema.String,
  text: Schema.String,
});

export type RichContent = Schema.Schema.Type<typeof richContentSchema>;

/** Assessment mode presets exposed to School users. */
export const assessmentModeSchema = Schema.Literal(
  "practice",
  "assignment",
  "quiz",
  "exam",
  "tryout"
);

export type AssessmentMode = Schema.Schema.Type<typeof assessmentModeSchema>;

/** Assessment authoring lifecycle states. */
export const assessmentStatusSchema = Schema.Literal(
  "draft",
  "scheduled",
  "published",
  "archived"
);

export type AssessmentStatus = Schema.Schema.Type<
  typeof assessmentStatusSchema
>;

/** Delivery visibility for assignments. */
export const assessmentAssignmentStatusSchema = Schema.Literal(
  "draft",
  "scheduled",
  "published",
  "closed",
  "archived"
);

/** Supported structured question types. */
export const assessmentQuestionTypeSchema = Schema.Literal(
  "mcq-single",
  "mcq-multi",
  "essay"
);

export type AssessmentQuestionType = Schema.Schema.Type<
  typeof assessmentQuestionTypeSchema
>;

/** Ranking scopes available for assessments. */
export const assessmentRankingScopeSchema = Schema.Literal(
  "none",
  "class",
  "school"
);

/** Monitoring strictness presets. */
export const assessmentMonitoringModeSchema = Schema.Literal(
  "off",
  "basic",
  "strict"
);

/** Grade release timing options. */
export const assessmentReleaseModeSchema = Schema.Literal(
  "instant",
  "manual",
  "scheduled"
);

/** Grading modes across objective and essay questions. */
export const assessmentGradingModeSchema = Schema.Literal(
  "auto",
  "manual",
  "hybrid"
);

/** Assignment target scopes for question banks. */
export const assessmentQuestionBankScopeSchema = Schema.Literal(
  "class",
  "school"
);

/** High-level attempt lifecycle states. */
export const assessmentAttemptStatusSchema = Schema.Literal(
  "in-progress",
  "submitted",
  "auto-submitted",
  "graded",
  "released"
);

/** Grading pipeline states. */
export const assessmentGradingStatusSchema = Schema.Literal(
  "pending",
  "auto-graded",
  "awaiting-manual-review",
  "graded"
);

/** Realtime session states for monitoring. */
export const assessmentSessionStatusSchema = Schema.Literal(
  "online",
  "offline",
  "submitted"
);

/** Monitoring events captured during attempts. */
export const assessmentAttemptEventTypeSchema = Schema.Literal(
  "heartbeat",
  "blur",
  "focus",
  "reconnect",
  "disconnect",
  "answer-saved",
  "submit",
  "fullscreen-exit",
  "paste",
  "copy",
  "idle"
);

/** Review states for monitoring flags. */
export const assessmentFlagReviewStatusSchema = Schema.Literal(
  "open",
  "reviewed",
  "dismissed"
);

/** Severity levels for monitoring flags. */
export const assessmentFlagSeveritySchema = Schema.Literal(
  "low",
  "medium",
  "high"
);

/** AI import job states. */
export const assessmentImportJobStatusSchema = Schema.Literal(
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
);

/** Question bank item provenance. */
export const assessmentQuestionSourceSchema = Schema.Literal(
  "manual",
  "bank",
  "ai-import"
);

/** Explicit retake policy contract. */
export const assessmentRetakePolicySchema = Schema.Struct({
  allowRetake: Schema.Boolean,
  maxAttempts: Schema.optional(Schema.Number),
});

/** Explicit timing policy contract. */
export const assessmentTimingPolicySchema = Schema.Struct({
  durationMinutes: Schema.optional(Schema.Number),
  perSection: Schema.Boolean,
});
