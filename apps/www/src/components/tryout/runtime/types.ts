import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";

/** Cohesive reactive state returned for one try-out section route. */
type TryoutSectionState = NonNullable<
  Ref.Returns<typeof tryouts.queries.runtime.getSectionAttemptState>
>;

/** Attempt state returned with one reactive try-out section. */
export type TryoutSectionAttempt = TryoutSectionState["attempt"];

/** Runtime data returned by one reactive try-out section state. */
export type TryoutSectionRuntime = NonNullable<TryoutSectionState["runtime"]>;

/** One ordered question in an active try-out section runtime. */
export type TryoutRuntimeQuestion = TryoutSectionRuntime["questions"][number];
