import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * The school roles that read a sitting's results: its Admin, its teacher, and its principal (the exam's
 * author and the Owner read them too). An Admin reads the results that an Admin releases.
 */
const resultViewers: (typeof RuleRole.Type)[] = [
  "admin",
  "teacher",
  "principal",
];

/** The school roles that release a sitting's results: the school's Admin (the exam's author and the Owner release them too). */
const resultReleasers: (typeof RuleRole.Type)[] = ["admin"];

/**
 * The school roles that grade a sitting's answers, as a teacher marks a paper: its Admin and its
 * teacher (the exam's author and the Owner grade them too).
 */
const resultGraders: (typeof RuleRole.Type)[] = ["admin", "teacher"];

/**
 * The results of one sitting, with the sitting row as its subject. A result is not a write to the
 * closed sitting, because releasing and grading follow the close: only a suspended school and an
 * archived unit refuse them (ADR 0012, decision 3). The release and each grade are journaled on the
 * sitting.
 */
export const resultKind = Kind.make("result", "examSittings", {
  actions: {
    "result.grade": {
      access: "write",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: resultGraders,
    },
    "result.release": {
      access: "write",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: resultReleasers,
    },
    "result.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["examAuthor"],
      roles: resultViewers,
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("exam.results.released") }),
    Schema.Struct({
      attempt: Id("examAttempts"),
      points: Schema.Int,
      question: Id("examQuestions"),
      type: Schema.Literal("exam.results.graded"),
    }),
  ],
  published: [],
  relations: ["examAuthor"],
});

/** The results module's kinds for the access catalog. */
export const results = { extensions: [], kinds: [resultKind] };
