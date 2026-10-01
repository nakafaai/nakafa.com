"use client";

import { Flag01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import {
  type PlayerQuestion,
  usePlayer,
  usePlayerPrompts,
} from "@/components/player/context";
import {
  type PlayerResponseLabel,
  ResponseFields,
} from "@/components/player/response";
import { TryoutQuestionHeader } from "@/components/tryout/runtime/question/shell.client";
import { TryoutResponseLabel } from "@/components/tryout/runtime/response/label.client";

/**
 * Renders one question: number, flag state, body, and response. Jumps focus
 * the article, so a screen reader announces the question it lands on.
 */
export function PlayerArticle({
  question,
}: {
  readonly question: PlayerQuestion;
}) {
  const t = useTranslations("Player");
  const prompt = usePlayerPrompts((prompts) => prompts.get(question.key));
  return (
    <article
      aria-labelledby={`question-${question.number}-title`}
      className="outline-none"
      data-player-key={question.key}
      tabIndex={-1}
    >
      <TryoutQuestionHeader questionOrder={question.number}>
        {question.flagged ? (
          <Badge variant="secondary">
            <HugeIcons icon={Flag01Icon} />
            {t("flagged")}
          </Badge>
        ) : null}
      </TryoutQuestionHeader>
      <section className="my-6">{prompt}</section>
      <section className="my-8">
        <PlayerResponse question={question} />
      </section>
    </article>
  );
}

/** Connects one question's response renderer to its bound answer action. */
function PlayerResponse({ question }: { readonly question: PlayerQuestion }) {
  const locked = usePlayer((session) => session.state.locked);
  const responses = usePlayer((session) => session.meta.responses);
  return (
    <ResponseFields
      registry={responses}
      value={{
        id: question.key,
        locked,
        onChange: question.answer,
        renderLabel: renderResponseLabel,
        responseSpec: question.responseSpec,
        selection: question.selection,
      }}
    />
  );
}

/** Renders one rich Markdown response label. */
function renderResponseLabel({ correctness, id, label }: PlayerResponseLabel) {
  return (
    <TryoutResponseLabel correctness={correctness} id={id}>
      {label}
    </TryoutResponseLabel>
  );
}
