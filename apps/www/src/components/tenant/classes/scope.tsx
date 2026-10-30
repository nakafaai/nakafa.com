import { Id } from "@repo/backend/confect/_generated/id";
import { ClassAddress } from "@repo/backend/confect/classroom/class";
import type { ClassResolved } from "@repo/backend/confect/classroom/classes.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";
import { createContext, use } from "react";

/** The class a class page shows: its ID, its address in the school, and the school's slug. */
const ClassScope = Schema.Struct({
  classId: Id("classes"),
  classSlug: ClassAddress,
  slug: TenantSlug,
});

/** The class that the class page provides to its tabs, its lists, and its links, with the class actions the viewer holds on it. */
export const ClassScopeContext = createContext<
  (typeof ClassScope.Type & Pick<typeof ClassResolved.Type, "can">) | null
>(null);

/** Reads the class of the class page around the caller. */
export function useClassScope() {
  const value = use(ClassScopeContext);

  if (value === null) {
    throw new Error("useClassScope must be used within a class page");
  }

  return value;
}
