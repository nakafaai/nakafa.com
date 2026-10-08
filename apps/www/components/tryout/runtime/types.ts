import type { Ref } from "@confect/core";
import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import type refs from "@repo/backend/confect/_generated/refs";

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

/** One public immutable response definition in an active question. */
export type TryoutRuntimeResponseSpec = TryoutRuntimeQuestion["responseSpec"];

/** Response definition rendered from either signed preview or attempt state. */
export type TryoutRenderableResponseSpec =
  | QuestionResponse
  | TryoutRuntimeResponseSpec;
