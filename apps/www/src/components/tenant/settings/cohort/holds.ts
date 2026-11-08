import type { Ref } from "@confect/core";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { createContext } from "react";

/** What the cohorts table reads of one cohort beside the list: its counts, its homeroom teacher and its hold. */
export type CohortOverviewRow = Ref.Returns<
  typeof tenancy.cohorts.overview
>[number];

/**
 * The cohorts table's overview, which a row's menu reads to offer Delete only for a cohort nothing holds, or null until
 * it is read, while the menu offers no Delete.
 */
export const CohortOverviewContext = createContext<
  readonly CohortOverviewRow[] | null
>(null);
