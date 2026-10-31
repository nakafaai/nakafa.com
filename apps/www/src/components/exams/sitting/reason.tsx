import { type ReactNode, useId } from "react";
import { useTranslations } from "use-intl";
import { SittingChoice } from "@/components/exams/sitting/choice";
import {
  type Choice,
  heldBy,
  withHeld,
} from "@/components/exams/sitting/response";

/**
 * The options of one choice on a paper, under its name when the question holds two: the answer and the reason.
 * A question of one choice names it in its prompt, so its options stand alone.
 */
export function ChoiceGroup({
  children,
  id,
  title,
}: {
  readonly children: ReactNode;
  /** The id of the name, for the options that a screen reader reads by it. */
  readonly id?: string;
  /** The key of the choice's name, or none for a question of one choice. */
  readonly title: "reason-answer" | "reason-title" | null;
}) {
  const t = useTranslations("Exams");

  return title === null ? (
    children
  ) : (
    <div className="grid gap-3">
      <p className="font-medium" id={id}>
        {t(title)}
      </p>
      {children}
    </div>
  );
}

/**
 * An answer and its reason: the question's two choices, one under the other, each under its name, which the one
 * response of the question answers together. Each change calls `onChoose` with the whole response, so the caller
 * saves it at once.
 */
export function SittingReason({
  answer,
  onChoose,
  reason,
  response,
}: {
  readonly answer: Choice;
  readonly onChoose: (response: readonly string[]) => void;
  readonly reason: Choice;
  readonly response: readonly string[];
}) {
  const answerId = useId();
  const reasonId = useId();

  return (
    <div className="grid gap-8">
      <ChoiceGroup id={answerId} title="reason-answer">
        <SittingChoice
          choice={answer}
          labelledBy={answerId}
          onChoose={(next) => onChoose(withHeld(answer, next, response))}
          response={heldBy(answer, response)}
        />
      </ChoiceGroup>
      <ChoiceGroup id={reasonId} title="reason-title">
        <SittingChoice
          choice={reason}
          labelledBy={reasonId}
          onChoose={(next) => onChoose(withHeld(reason, next, response))}
          response={heldBy(reason, response)}
        />
      </ChoiceGroup>
    </div>
  );
}
