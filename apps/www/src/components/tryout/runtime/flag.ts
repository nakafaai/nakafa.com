import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { Array as Arr } from "effect";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";

type FlagArgs = Ref.Args<typeof tryouts.mutations.responses.flag>;

/**
 * The running section as it reads once one of its questions takes the flag
 * that `args` sets, which the player shows before the server answers. It is
 * none when the section does not hold that question, so a cached copy of
 * another section stays as the server sent it.
 */
export function flagTryoutQuestion(
  runtime: TryoutSectionRuntime,
  args: FlagArgs
): TryoutSectionRuntime | null {
  if (
    !Arr.some(
      runtime.questions,
      (question) => question.placementId === args.placementId
    )
  ) {
    return null;
  }
  return {
    ...runtime,
    questions: Arr.map(runtime.questions, (question) =>
      question.placementId === args.placementId
        ? { ...question, flagged: args.flagged }
        : question
    ),
  };
}
