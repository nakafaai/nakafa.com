import type { TryoutQuestionBody as Body } from "@repo/backend/confect/tryouts/runtime/spec";
import { Separator } from "@repo/design-system/components/ui/separator";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { readQuestionIds } from "@/components/player/ids";
import {
  PlayerQuestionAnswer,
  PlayerQuestionHeader,
  PlayerQuestionPrompt,
} from "@/components/player/question";
import {
  TryoutExplanationBody,
  TryoutQuestionBody,
} from "@/components/tryout/runtime/question/body";
import { TryoutReviewedFields } from "@/components/tryout/runtime/response/review";

const setRoute = getRouteApi(
  "/$locale/_main/try-out/$country/$exam/$group/$track/$set/"
);

/** The DOM id of the heading that names the samples. */
const SAMPLES_TITLE = "tryout-samples";

/**
 * The set's worked samples, under its parts: the free preview of its first section, each question with
 * its options marked against the key and its explanation open, as a finished section shows them. The
 * build prerenders them with the page, so readers and search engines meet the set's real questions
 * before they start it. Its code loads later (`TryoutSetSamplesLater`).
 */
export function TryoutSetSamples() {
  const t = useTranslations("Tryouts");
  const samples = setRoute.useLoaderData({ select: (route) => route.samples });

  return (
    <section aria-labelledby={SAMPLES_TITLE} className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-medium" id={SAMPLES_TITLE}>
          {t("samples-title")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t("samples-description")}
        </p>
      </header>
      {Arr.map(samples, (sample, index) => (
        <TryoutSample
          body={sample.body}
          key={sample.versionHash}
          number={index + 1}
        />
      ))}
    </section>
  );
}

/** One worked sample: its prompt, its options marked against the key, and its explanation. */
function TryoutSample({ body, number }: { body: Body; number: number }) {
  const t = useTranslations("Tryouts");
  const ids = readQuestionIds(number);

  return (
    <article aria-labelledby={ids.title} id={ids.article}>
      <PlayerQuestionHeader number={number} />
      <PlayerQuestionPrompt>
        <TryoutQuestionBody body={body} />
      </PlayerQuestionPrompt>
      {body.key === undefined ? null : (
        <PlayerQuestionAnswer>
          <TryoutReviewedFields
            answer={body.key}
            id={`sample-${number}`}
            interaction={body.interaction}
            response={null}
          />
        </PlayerQuestionAnswer>
      )}
      {body.explanation === undefined ? null : (
        <section className="space-y-6 pb-8">
          <Separator />
          <h3 className="text-lg font-medium">{t("explanation")}</h3>
          <TryoutExplanationBody body={body} />
        </section>
      )}
    </article>
  );
}
