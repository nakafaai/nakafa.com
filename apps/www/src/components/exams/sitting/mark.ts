import { useMutation } from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";
import { sittingCallFailures } from "@/components/exams/sitting/actions";
import { changePaper, setPaperFlag } from "@/components/exams/sitting/paper";

/** One flag that the student sets or clears, which names the question and its sitting. */
const FlagInput = Schema.Struct({
  deviceId: Schema.String,
  flagged: Schema.Boolean,
  questionId: Id("examQuestions"),
  sittingId: Id("examSittings"),
  slug: TenantSlug,
});
type FlagInput = typeof FlagInput.Type;

/**
 * Flags or unflags one question for review. The paper shows the flag at once, and a refused flag rolls it back,
 * because the paper is read again from the server. The flag is the server's, so the browser keeps none.
 */
function useFlagMutation() {
  return useMutation(exams.sittings.flag).withOptimisticUpdate(
    (localStore, args) =>
      changePaper(localStore, args, (paper) =>
        setPaperFlag(paper, args.questionId, args.flagged)
      )
  );
}

/**
 * Sends one flag change, and resolves to the failure that the caller tells the student about, or to none when
 * the server took the change, so the caller shows its failures with one toast.
 */
export function useMarkFlag() {
  const flag = useFlagMutation();

  return (input: FlagInput) =>
    Effect.tryPromise(() => flag(input)).pipe(
      Effect.flatMap(Effect.fromResult),
      Effect.match({
        onFailure: (error) => Option.some(error),
        onSuccess: () => Option.none(),
      })
    );
}

/**
 * Flags one question of the student's paper, or takes its flag off, and tells the student with one toast when
 * the server refuses it. The footer, the keys and each question's own flag send it the same way.
 */
export function useFlagQuestion(sitting: {
  readonly deviceId: string;
  readonly sittingId: FlagInput["sittingId"];
  readonly slug: FlagInput["slug"];
}) {
  const mark = useMarkFlag();

  return (question: {
    readonly flagged: boolean;
    readonly id: FlagInput["questionId"];
  }) =>
    Effect.runPromise(
      mark({
        ...sitting,
        flagged: !question.flagged,
        questionId: question.id,
      }).pipe(
        Effect.flatMap((failure) =>
          sittingCallFailures(Option.toArray(failure))
        )
      )
    );
}
