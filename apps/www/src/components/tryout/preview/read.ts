import "@tanstack/react-start/server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Option } from "effect";
import type { Locale } from "use-intl";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type QuestionPreviewContent,
  readQuestionPreview,
} from "@/lib/content/preview/question";

/** Reads a question only inside the explicitly configured development child. */
export const readTryoutQuestionPreview = Effect.fn(
  "www.tryout.preview.readQuestion"
)(function* (locale: Locale, publicPath: string) {
  if (!hasPreviewConfig()) {
    return Option.none<QuestionPreviewContent>();
  }
  return yield* readQuestionPreview({
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
});
