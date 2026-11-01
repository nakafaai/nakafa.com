import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Function as Fn } from "effect";
import { createContext } from "react";

/** One class group of the period, as the export menu lists it. */
export type GradeCohort = Ref.Returns<typeof tenancy.cohorts.list>[number];

/** The save of one class group's report data, which the menu's items run when chosen. */
export const GradeDownloadContext = createContext<
  (cohort: GradeCohort) => void
>(Fn.constVoid);
