import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import {
  VisitEndReason,
  VisitMinutes,
  VisitReason,
} from "@repo/backend/confect/operators/schema";
import { person, tenant } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/**
 * One visit of an operator to a school. The school's Owner or Admin ends it, and
 * so does the operator, who is its visitor. Ending is a transition, so a school
 * that is suspended can still end a visit (ADR 0012).
 */
export const visit = Kind.make("visit", "tenantVisits", {
  actions: {
    "visit.end": {
      access: "transition",
      grantedBy: "roles",
      relations: ["visitor"],
      roles: ["admin"],
    },
  },
  changes: [
    Schema.Struct({
      minutes: VisitMinutes,
      reason: VisitReason,
      type: Schema.Literal("visit.requested"),
    }),
    Schema.Struct({
      grant: Id("tenantGrants"),
      person: Id("tenantPeople"),
      type: Schema.Literal("visit.approved"),
    }),
    Schema.Struct({ type: Schema.Literal("visit.declined") }),
    Schema.Struct({
      reason: VisitEndReason,
      type: Schema.Literal("visit.ended"),
    }),
  ],
  published: [],
  relations: ["visitor"],
});

/**
 * The school's Owner and Admin decide whether an operator may visit, and the
 * tenant changes an operator makes: suspending and reactivating a school.
 */
const tenantOperators = Kind.extend(tenant, {
  actions: {
    "visit.approve": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin"],
    },
  },
  changes: [
    Schema.Struct({ type: Schema.Literal("tenant.suspended") }),
    Schema.Struct({ type: Schema.Literal("tenant.reactivated") }),
  ],
  published: [],
});

/** An operator's Person is suspended between visits and reactivated for the next one. */
const personOperators = Kind.extend(person, {
  actions: {},
  changes: [
    Schema.Struct({ type: Schema.Literal("person.reactivated") }),
    Schema.Struct({ type: Schema.Literal("person.suspended") }),
  ],
  published: [],
});

export const operators = {
  extensions: [tenantOperators, personOperators],
  kinds: [visit],
} as const;
