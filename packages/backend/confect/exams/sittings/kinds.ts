import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import {
  Minutes,
  ReasonCode,
} from "@repo/backend/confect/exams/sittings/schema";
import { Schema } from "effect";

/** The school roles that proctor a sitting: its teacher and the school's Admin. The Owner is implicit. */
const sittingProctors: (typeof RuleRole.Type)[] = ["teacher", "admin"];

/** The roles that view a sitting's dashboard: the proctors, and the Principal and the Deputy, who take no action. */
const sittingViewers: (typeof RuleRole.Type)[] = [
  "teacher",
  "admin",
  "principal",
  "deputy",
];

/**
 * One proctored sitting. A teacher or an Admin whose grant covers its unit, every Owner,
 * and the author of its exam may proctor it, which is the `sitting.proctor` action. The
 * same people, with the Principal and the Deputy, may view it, which is `sitting.view`.
 * The session proctor relation comes later (ADR 0013). A sitting in a closed state or an
 * archived unit locks its writes.
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
  ],
  published: [],
  relations: ["examAuthor"],
});

/** The sitting lane's kinds and extensions, joined into the access catalog. */
export const sitting = { extensions: [], kinds: [sittingKind] };
