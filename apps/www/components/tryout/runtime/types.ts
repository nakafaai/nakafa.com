import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** Declares that the mounted client consumes canonical response selections. */
export const tryoutRuntimeQueryContract = {
  responseContract: "structured" as const,
};

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

/** One public immutable response definition in an active question. */
export type TryoutRuntimeResponseSpec = TryoutRuntimeQuestion["responseSpec"];
