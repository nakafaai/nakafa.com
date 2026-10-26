import { Id } from "@repo/backend/confect/_generated/id";
import { Kind } from "@repo/backend/confect/access/kind";
import { ConsentMethod } from "@repo/backend/confect/guardians/schema";
import { person, tenant } from "@repo/backend/confect/tenancy/kinds";
import { Schema } from "effect";

/**
 * One guardian link (ADR 0034). The school's Admin and Staff (Staf TU) read the
 * links, check one by hand, and revoke one. The guardian of the link holds the
 * `guardian` relation: they run the NISN check and withdraw consent, and no role,
 * not even Owner, may do either for them. A verified link is the `verifiedParent`
 * relation, the only way a guardian reaches the child's released records.
 */
export const guardianLinkKind = Kind.make("guardianLink", "guardianLinks", {
  actions: {
    "guardian.child": {
      access: "read",
      grantedBy: "relations",
      relations: ["verifiedParent"],
    },
    "guardian.confirm": {
      access: "write",
      grantedBy: "relations",
      relations: ["guardian"],
    },
    "guardian.revoke": {
      access: "transition",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "staff"],
    },
    "guardian.verify": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "staff"],
    },
    "guardian.view": {
      access: "read",
      grantedBy: "roles",
      relations: ["guardian"],
      roles: ["admin", "staff", "principal"],
    },
    "guardian.withdraw": {
      access: "transition",
      grantedBy: "relations",
      relations: ["guardian"],
    },
  },
  changes: [
    Schema.Struct({
      guardian: Id("tenantPeople"),
      student: Id("tenantPeople"),
      type: Schema.Literal("guardian.started"),
    }),
    Schema.Struct({
      method: ConsentMethod,
      student: Id("tenantPeople"),
      type: Schema.Literal("guardian.linked"),
    }),
    Schema.Struct({
      student: Id("tenantPeople"),
      type: Schema.Literal("guardian.withdrawn"),
    }),
    Schema.Struct({
      student: Id("tenantPeople"),
      type: Schema.Literal("guardian.revoked"),
    }),
  ],
  published: ["guardian.linked", "guardian.withdrawn"],
  relations: ["guardian", "verifiedParent"],
});

/** Staff starts a link for a student: the action is ruled on the student's Person. */
const guardianPerson = Kind.extend(person, {
  actions: {
    "guardian.link": {
      access: "write",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "staff"],
    },
  },
  changes: [],
  published: [],
});

/** Staff lists every link of the school: the action is ruled on the school. */
const guardianTenant = Kind.extend(tenant, {
  actions: {
    "guardian.list": {
      access: "read",
      grantedBy: "roles",
      relations: [],
      roles: ["admin", "staff", "principal"],
    },
  },
  changes: [],
  published: [],
});

/** The guardians module's kinds for the access catalog: the link, and its extensions on the Person and the school. */
export const guardians = {
  extensions: [guardianPerson, guardianTenant],
  kinds: [guardianLinkKind],
};
