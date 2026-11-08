import type { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { createContext } from "react";

/**
 * The level of the unit whose cohorts the page shows, which sets the grades a cohort of it may hold. The cohorts page
 * provides it for the unit it shows, and the grade field of the dialogs that add and edit a cohort reads it.
 */
export const CohortLevelContext = createContext<typeof UnitLevel.Type | null>(
  null
);
