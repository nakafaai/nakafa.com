import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";
import type { TryoutRenderableResponseSpecSchema } from "@/components/tryout/runtime/response/state";

/** Cohesive reactive state returned for one try-out section route. */
export type TryoutSectionState = NonNullable<
  Ref.Returns<typeof refs.public.tryouts.queries.runtime.getSectionAttemptState>
>;

/** Attempt state returned with one reactive try-out section. */
export type TryoutSectionAttempt = TryoutSectionState["attempt"];

/** Runtime data returned by one reactive try-out section state. */
export type TryoutSectionRuntime = NonNullable<TryoutSectionState["runtime"]>;

/** One ordered question in an active try-out section runtime. */
export type TryoutRuntimeQuestion = TryoutSectionRuntime["questions"][number];

/** Response definition rendered from either signed preview or attempt state. */
export type TryoutRenderableResponseSpec =
  typeof TryoutRenderableResponseSpecSchema.Type;
