import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

type SetFlagArgs = Ref.Args<typeof refs.public.tryouts.mutations.flags.set>;

/** Applies one flag locally; `null` when the placement is not in this runtime. */
export function applyOptimisticTryoutFlag(
  runtime: TryoutSectionRuntime,
  args: SetFlagArgs
): TryoutSectionRuntime | null {
  if (
    !runtime.questions.some(
      (question) => question.placementId === args.placementId
    )
  ) {
    return null;
  }
  return {
    ...runtime,
    questions: runtime.questions.map((question) =>
      question.placementId === args.placementId
        ? { ...question, flagged: args.flagged }
        : question
    ),
  };
}
