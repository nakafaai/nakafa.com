import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** Cohesive reactive state returned for one try-out section route. */
export type TryoutSectionState = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.runtime.getSectionAttemptState>
>;

/** Attempt state returned with one reactive try-out section. */
export type TryoutSectionAttempt = TryoutSectionState["attempt"];

/** Runtime data returned by one reactive try-out section state. */
export type TryoutSectionRuntime = NonNullable<TryoutSectionState["runtime"]>;

/** One ordered question in an active try-out section runtime. */
export type TryoutRuntimeQuestion = TryoutSectionRuntime["questions"][number];

/** One selectable choice in an active try-out runtime question. */
export type TryoutRuntimeChoice = TryoutRuntimeQuestion["choices"][number];
