import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import {
  Minutes,
  ReasonCode,
} from "@repo/backend/confect/exams/sittings/schema";
import { Schema } from "effect";

/**
 * The school roles that proctor a sitting: its teacher, the school's Admin, and the Proctor, who runs the
 * rooms of the units the role covers and writes no exam, grade or setting. The Owner is implicit.
 */
const sittingProctors: (typeof RuleRole.Type)[] = [
  "teacher",
  "admin",
  "proctor",
];

/** The roles that view a sitting's dashboard: the proctors, and the Principal and the Deputy, who take no action. */
const sittingViewers: (typeof RuleRole.Type)[] = [
  ...sittingProctors,
  "principal",
  "deputy",
];

/**
 * One proctored sitting. A teacher, an Admin, or a Proctor whose grant covers its unit, every
 * Owner, and the author of its exam may proctor it, which is the `sitting.proctor` action: open
 * and close it, change its token, lock and unlock an attempt, add minutes, and allow a second
 * device. The same people, with the Principal and the Deputy, may view it, which is
 * `sitting.view`. A sitting in a closed state or an archived unit locks its writes.
 */
export const sittingKind = Kind.make("sitting", "examSittings", {
  actions: {
    "sitting.proctor": {
      access: "write",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: sittingProctors,
    },
    "sitting.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: sittingViewers,
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("sitting.schedule") }),
    Schema.Struct({
      attempt: Id("examAttempts"),
      reason: ReasonCode,
      type: Schema.Literal("sitting.lock"),
    }),
    Schema.Struct({
      attempt: Id("examAttempts"),
      reason: ReasonCode,
      type: Schema.Literal("sitting.unlock"),
    }),
    Schema.Struct({
      attempt: Id("examAttempts"),
      minutes: Minutes,
      reason: ReasonCode,
      type: Schema.Literal("sitting.addMinutes"),
    }),
    Schema.Struct({ type: Schema.Literal("sitting.changeToken") }),
    Schema.Struct({
      attempt: Id("examAttempts"),
      type: Schema.Literal("sitting.allowDevice"),
    }),
    Schema.Struct({
      attempt: Id("examAttempts"),
      type: Schema.Literal("sitting.finish"),
    }),
    Schema.Struct({ type: Schema.Literal("sitting.close") }),
    Schema.Struct({ type: Schema.Literal("sitting.cancel") }),
    Schema.Struct({ type: Schema.Literal("sitting.reschedule") }),
    // A student who joined the school by the room's code, journaled under that student.
    Schema.Struct({
      person: Id("tenantPeople"),
      type: Schema.Literal("sitting.join"),
    }),
  ],
  published: [],
  relations: ["examAuthor"],
});

/** The sitting lane's kinds and extensions, joined into the access catalog. */
export const sitting = { extensions: [], kinds: [sittingKind] };
