import type { TryoutQuestionBody as Body } from "@repo/backend/confect/tryouts/runtime/spec";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { AssessmentDocument } from "@/components/assessment/document";
import type { AssessmentPlace } from "@/components/assessment/interaction";
import { AssessmentPlaceContext } from "@/components/assessment/interaction";

/**
 * The body of one question as the learner reads it: the shared reading it was written against, when it
 * has one, and then its prompt, each through the assessment document renderer. The server draws the
 * documents, and each body hydrates in a boundary of its own, so a page of many questions hydrates its
 * shell first: the shell's lock and the player's controls take the page over without waiting for
 * every formula of every question. Nothing inside suspends, so the boundary shows no fallback. A question of
 * several parts draws the field of each part where its prompt puts it (`place`).
 */
export function TryoutQuestionBody({
  body,
  place,
}: {
  readonly body: Pick<Body, "prompt" | "stimulus">;
  /** The field of the part at one place of the prompt. */
  readonly place?: ((place: AssessmentPlace) => ReactNode) | undefined;
}) {
  const t = useTranslations("Tryouts");

  return (
    <Suspense fallback={null}>
      <div className="grid gap-6">
        {body.stimulus === undefined ? null : (
          <AssessmentDocument document={body.stimulus} label={t("reading")} />
        )}
        <AssessmentPlaceContext value={place ?? null}>
          <AssessmentDocument document={body.prompt} label={t("prompt")} />
        </AssessmentPlaceContext>
      </div>
    </Suspense>
  );
}

/** The explanation of a reviewed question, through the same reader and in a boundary of its own, when its version has one. */
export function TryoutExplanationBody({
  body,
}: {
  readonly body: Pick<Body, "explanation">;
}) {
  const t = useTranslations("Tryouts");

  return body.explanation === undefined ? null : (
    <Suspense fallback={null}>
      <AssessmentDocument
        document={body.explanation}
        label={t("explanation")}
      />
    </Suspense>
  );
}
