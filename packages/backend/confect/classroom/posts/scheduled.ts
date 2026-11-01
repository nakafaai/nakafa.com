import { Id } from "@repo/backend/confect/_generated/id";
import { ClientKey } from "@repo/backend/confect/classroom/forum/message";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { Schema } from "effect";

/** The most announcements one class holds waiting for their time. */
export const SCHEDULED_LIMIT = 50;

/**
 * One announcement waiting for its time (ADR 0025). Its text is sealed and bound as a post's is
 * (`postField`), so at `publishAt` it moves to the class's posts as it stands, and `jobId` is the run that
 * moves it, which a new time or a cancel replaces.
 */
export const scheduledValidator = Schema.Struct({
  authorId: Id("tenantPeople"),
  classId: Id("classes"),
  clientKey: ClientKey,
  createdAt: Schema.Finite,
  email: Schema.Boolean,
  jobId: Id("_scheduled_functions"),
  publishAt: Schema.Finite,
  sealedText: Sealed,
  tenantId: Id("tenants"),
});

/** One waiting announcement as its author reads it on the class home. */
export const ScheduledView = Schema.Struct({
  clientKey: ClientKey,
  email: Schema.Boolean,
  id: Id("classroomScheduled"),
  publishAt: Schema.Finite,
  text: Schema.String,
});
