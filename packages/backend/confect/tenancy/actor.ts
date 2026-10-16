import type {
  OperatorsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import type { TenantActor } from "@repo/backend/confect/journal/schema";

/** The member who asked for a change is the actor the journal files it under. */
export const personActor = (
  person: TenantPeopleDoc
): typeof TenantActor.Type => ({ id: person._id, kind: "person" });

/** The Nakafa staff member who acts outside a visit, such as to open or suspend a school. */
export const operatorActor = (
  operator: OperatorsDoc
): typeof TenantActor.Type => ({ id: operator._id, kind: "operator" });

/** Work the system does for no Person: a claim, an expiry, a release, or the opening of a school. */
export const systemActor: typeof TenantActor.Type = { kind: "system" };
