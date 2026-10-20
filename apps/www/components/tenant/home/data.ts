import type { Returns } from "@confect/core/Ref";
import type exams from "@repo/backend/confect/_generated/refs/exams";
import type tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { createContext } from "react";

/**
 * The first screen of the school home, as the home's loader read it on the server.
 * Each tile shows its loader's value until its live read answers, and the value of
 * a read that the viewer's view does not make is none.
 */
export interface HomePreload {
  readonly home?: Returns<typeof exams.exams.home> | undefined;
  readonly setup?: Returns<typeof tenancy.home.setup> | undefined;
  readonly sittings?: Returns<typeof exams.sittings.mine> | undefined;
}

/** The loader's first screen of the school home, which the home's reads read from. */
export const HomePreloadContext = createContext<HomePreload>({});
