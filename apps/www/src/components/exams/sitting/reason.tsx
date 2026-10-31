import { type ReactNode, useId } from "react";
import { useTranslations } from "use-intl";
import { SittingChoice } from "@/components/exams/sitting/choice";
import {
  type Choice,
  heldBy,
  withHeld,
} from "@/components/exams/sitting/response";

/** The name above a question's reasons, wherever they are read or written. */
export function ReasonTitle({ id }: { readonly id?: string }) {
  const t = useTranslations("Exams");

  return (
    <p className="font-medium" id={id}>
      {t("reason-title")}
    </p>
  );
}

/** The options of one choice on a paper: a reason stands under its name, and any other choice stands alone. */
export function ChoiceGroup({
  children,
  reason,
}: {
  readonly children: ReactNode;
  /** Whether the options are a question's reasons. */
  readonly reason: boolean;
}) {
  return reason ? (
    <div className="grid gap-3">
      <ReasonTitle />
      {children}
    </div>
  ) : (
    children
  );
}

/**
 * An answer and its reason: the question's two choices, one under the other, which the one response of the
 * question answers together. Each change calls `onChoose` with the whole response, so the caller saves it at once.
 */
export function SittingReason({
  answer,
  labelledBy,
  onChoose,
  reason,
  response,
}: {
  readonly answer: Choice;
  /** The id of the heading that names the question. */
  readonly labelledBy: string;
  readonly onChoose: (response: readonly string[]) => void;
  readonly reason: Choice;
  readonly response: readonly string[];
}) {
  const id = useId();

  return (
    <div className="grid gap-8">
      <SittingChoice
        choice={answer}
        labelledBy={labelledBy}
        onChoose={(next) => onChoose(withHeld(answer, next, response))}
        response={heldBy(answer, response)}
      />
      <div className="grid gap-3">
        <ReasonTitle id={id} />
        <SittingChoice
          choice={reason}
          labelledBy={id}
          onChoose={(next) => onChoose(withHeld(reason, next, response))}
          response={heldBy(reason, response)}
        />
      </div>
    </div>
  );
}
