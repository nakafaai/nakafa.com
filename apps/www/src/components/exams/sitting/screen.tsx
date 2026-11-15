import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import {
  chosenOptions,
  madePairs,
  markedCells,
  NO_RESPONSE,
  typedText,
} from "@repo/backend/confect/assessment/response";
import { DeferredLearnerText } from "@repo/design-system/components/markdown/deferred";
import { JsonTextSchema } from "@repo/utilities/json";
import { Function as Fn, Option, Schema } from "effect";
import { useId, useMemo } from "react";
import { useTranslations } from "use-intl";
import { SittingChoice } from "@/components/exams/sitting/choice";
import { useSittingData } from "@/components/exams/sitting/context";
import { SittingDocument } from "@/components/exams/sitting/document";
import { PaperLockProvider } from "@/components/exams/sitting/lock";
import { SittingPairs } from "@/components/exams/sitting/pairs";
import { SittingTable } from "@/components/exams/sitting/table";
import {
  choiceOf,
  pairingOf,
  tableOf,
  writtenOf,
} from "@/components/player/response";

/**
 * One student's screen in the proctor's panel (K25): the question the student's screen shows now, with
 * its prompt and the answer the student saved, drawn from the exam's data the way the student's paper
 * draws it, and read only. Only the panel open on a student reads its screen, so the room's dashboard
 * never does. Before the student opens a question the panel shows a sentence instead.
 */
export function StudentScreen({
  attemptId,
}: {
  readonly attemptId: GenericId.GenericId<"examAttempts">;
}) {
  const t = useTranslations("Exams");
  const titleId = useId();
  const { slug, value } = useSittingData();
  const read = useQuery(exams.screens.screen, {
    attemptId,
    sittingId: value.sitting.id,
    slug,
  });
  const screen = QueryResult.isSuccess(read) ? read.value : null;
  const prompt = useMemo(
    () =>
      screen === null ? null : Schema.decodeSync(JsonTextSchema)(screen.prompt),
    [screen]
  );

  if (!QueryResult.isSuccess(read)) {
    return null;
  }
  if (screen === null || prompt === null) {
    return (
      <div className="grid gap-2">
        <p className="text-muted-foreground text-sm">{t("screen-title")}</p>
        <p className="text-sm">{t("screen-none")}</p>
      </div>
    );
  }
  const response = screen.response ?? NO_RESPONSE;
  const choice = choiceOf(screen.interactions);
  const written = writtenOf(screen.interactions);
  const pairing = pairingOf(screen.interactions);
  const table = tableOf(screen.interactions);

  return (
    <PaperLockProvider locked>
      <section aria-labelledby={titleId} className="grid gap-3">
        <p className="text-muted-foreground text-sm">{t("screen-title")}</p>
        <h3 className="font-medium" id={titleId}>
          {t("question", { number: screen.number })}
        </h3>
        <SittingDocument document={prompt} />
        {Option.isSome(choice) ? (
          <SittingChoice
            choice={choice.value}
            labelledBy={titleId}
            onChoose={Fn.constVoid}
            response={chosenOptions(response)}
          />
        ) : null}
        {Option.isSome(written) ? (
          <ScreenWritten
            essay={written.value.kind === "extendedText"}
            text={typedText(response)}
          />
        ) : null}
        {Option.isSome(pairing) ? (
          <SittingPairs
            labelledBy={titleId}
            match={pairing.value}
            onPair={Fn.constVoid}
            pairs={madePairs(response)}
          />
        ) : null}
        {Option.isSome(table) ? (
          <SittingTable
            cells={markedCells(response)}
            onMark={Fn.constVoid}
            table={table.value}
          />
        ) : null}
      </section>
    </PaperLockProvider>
  );
}

/**
 * What the student wrote: an essay drawn with its formulas and lists, as the results draw it, and a short answer or a
 * number as the student typed it. A blank answer says so.
 */
function ScreenWritten({ essay, text }: { essay: boolean; text: string }) {
  const t = useTranslations("Exams");
  if (text === "") {
    return (
      <p className="rounded-md border p-3 text-sm">{t("student-no-answer")}</p>
    );
  }
  return essay ? (
    <div className="rounded-md border p-3">
      <DeferredLearnerText>{text}</DeferredLearnerText>
    </div>
  ) : (
    <p className="rounded-md border p-3 text-sm whitespace-pre-wrap" dir="auto">
      {text}
    </p>
  );
}
