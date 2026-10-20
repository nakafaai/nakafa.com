import { QueryResult, useQuery } from "@confect/react";
import editors from "@repo/backend/confect/_generated/refs/editor";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { Option } from "effect";
import { useId } from "react";
import { useTranslations } from "use-intl";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { choiceOf } from "@/components/exams/sitting/response";
import type { Question } from "@/components/tenant/exams/optimistic";
import { useExamTry, useTrySlug } from "@/components/tenant/exams/try/context";

/** The session name the try reads prompts under. It never writes, so the server records nothing. */
const TRY_CLIENT = "try";

/**
 * The prompt loads once its document has opened, with the editor's schema and the fold that
 * applies the steps, so the try's first page carries neither (the editor's prompt does the same).
 */
const TryPrompt = lazyComponent(
  () =>
    import("@/components/tenant/exams/try/prompt").then(
      (module) => module.TryPrompt
    ),
  { loading: () => null, ssr: false }
);

/**
 * One question as a student meets it: its number, its prompt, and its options, with the same
 * controls as the paper of a sitting. The options are answered in the browser only, through the
 * try's own answers, so nothing is sent.
 */
export function ExamTryQuestion({
  number,
  question,
}: {
  number: number;
  question: Question;
}) {
  const t = useTranslations("Exams");
  const slug = useTrySlug();
  const titleId = useId();
  const reply = useQuery(editors.documents.open, {
    clientId: TRY_CLIENT,
    documentId: question.prompt,
    slug,
  });
  const response = useExamTry((state) => state.responses[question.id]);
  const choose = useExamTry((state) => state.choose);
  const choice = choiceOf(question.answers);

  return (
    <section aria-labelledby={titleId} className="grid gap-6">
      <h2 className="font-medium" id={titleId}>
        {t("question", { number })}
      </h2>
      {QueryResult.isSuccess(reply) ? (
        <TryPrompt key={question.prompt} opened={reply.value} />
      ) : null}
      {Option.isSome(choice) ? (
        <SittingChoice
          choice={choice.value}
          labelledBy={titleId}
          onChoose={(next) => choose(question.id, next)}
          response={response ?? []}
        />
      ) : null}
    </section>
  );
}
