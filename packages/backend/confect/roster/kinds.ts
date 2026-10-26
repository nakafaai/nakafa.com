import { Kind } from "@repo/backend/confect/access/kind";
import { person } from "@repo/backend/confect/tenancy/kinds";
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

/** The roster module's kinds for the access catalog: its extension of the Person. */
export const roster = {
  extensions: [rosterPerson],
  kinds: [],
};
