import "@tanstack/react-start/server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Option } from "effect";
import { cache } from "react";
import type { Locale } from "use-intl";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import {
  type QuestionPreviewContent,
  readQuestionPreview,
} from "@/lib/content/preview/question";

/** Reads a question only inside the explicitly configured development child. */
export const readTryoutQuestionPreview = cache(
  async (locale: Locale, publicPath: string) => {
    if (!hasPreviewConfig()) {
      return Option.none<QuestionPreviewContent>();
    }

    return await Effect.runPromise(
      readQuestionPreview({
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      })
    );
  }
);
