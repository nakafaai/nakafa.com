import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** Runtime data returned by the active try-out section query. */
export type TryoutSectionRuntime = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.runtime.getSection>
>;

/** One ordered question in an active try-out section runtime. */
export type TryoutRuntimeQuestion = TryoutSectionRuntime["questions"][number];

/** One selectable choice in an active try-out runtime question. */
export type TryoutRuntimeChoice = TryoutRuntimeQuestion["choices"][number];
