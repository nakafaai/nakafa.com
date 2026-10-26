import { Kind } from "@repo/backend/confect/access/kind";
import { period, person } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/**
 * The school's Admin and Staff (Staf TU) keep a student's roster row: the NISN and
 * the under-age flag (ADR 0034). The action is ruled on the student's Person, and
 * the change holds no NISN and no flag, only that the row changed (ADR 0016).
 */
const rosterPerson = Kind.extend(person, {
  actions: {
    "roster.manage": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "staff"],
    },
    "roster.view": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "staff", "principal"],
    },
  },
  changes: [Schema.Struct({ type: Schema.Literal("roster.set") })],
  published: [],
});

/**
 * The school's Admin and Staff import a Dapodik file into one period (ADR 0015): the
 * action is ruled on the period, so an archived period refuses it. Each batch is journaled
 * as `roster.imported` with its counts, never a name or a NISN (ADR 0016).
 */
const rosterPeriod = Kind.extend(period, {
  actions: {
    "roster.import": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "staff"],
    },
  },
  changes: [
    Schema.Struct({
      added: Schema.Finite,
      changed: Schema.Finite,
      skipped: Schema.Finite,
      source: Schema.Literal("dapodik"),
      type: Schema.Literal("roster.imported"),
    }),
  ],
  published: [],
});

/** The roster module's kinds for the access catalog: its extensions of the Person and the period. */
export const roster = {
  extensions: [rosterPerson, rosterPeriod],
  kinds: [],
};
