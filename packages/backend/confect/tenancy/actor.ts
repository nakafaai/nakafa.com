import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import type { TenantActor } from "@repo/backend/confect/journal/schema";

/** The member who asked for a change is the actor the journal files it under. */
export const personActor = (
  person: TenantPeopleDoc
): typeof TenantActor.Type => ({ id: person._id, kind: "person" });
