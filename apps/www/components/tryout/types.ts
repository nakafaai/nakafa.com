import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

/** Runtime data returned by the active try-out section query. */
export type TryoutSectionRuntime = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.attempt.getSectionRuntime>
>;

/** Canonical arguments for the active try-out section runtime query. */
export type TryoutSectionRuntimeArgs = FunctionArgs<
  typeof api.tryouts.queries.attempt.getSectionRuntime
>;

/** One ordered question in an active try-out section runtime. */
export type TryoutRuntimeQuestion = TryoutSectionRuntime["questions"][number];

/** One selectable choice in an active try-out runtime question. */
export type TryoutRuntimeChoice = TryoutRuntimeQuestion["choices"][number];
