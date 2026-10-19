import { Kind } from "@repo/backend/confect/access/kind";
import type { RuleRole } from "@repo/backend/confect/access/schema";
import { Schema } from "effect";

/** The school roles that read a sitting's results: its teacher and its principal (the exam's author and the Owner read them too). */
const resultViewers: (typeof RuleRole.Type)[] = ["teacher", "principal"];

/** The school roles that release a sitting's results: the school's Admin (the exam's author and the Owner release them too). */
const resultReleasers: (typeof RuleRole.Type)[] = ["admin"];

/**
 * The results of one sitting, with the sitting row as its subject. A result is not a write to the
 * closed sitting, because releasing follows the close: only a suspended school and an archived unit
 * refuse the release (ADR 0012, decision 3). The release is journaled on the sitting.
 */
export const resultKind = Kind.make("result", "examSittings", {
  actions: {
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
  changes: [Schema.Struct({ type: Schema.Literal("exam.results.released") })],
  published: [],
  relations: ["examAuthor"],
});

/** The results module's kinds for the access catalog. */
export const results = { extensions: [], kinds: [resultKind] };
