import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect, Option } from "effect";
import { io } from "next/cache";
import type { Locale } from "next-intl";
import { cache } from "react";
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

    await io();
    return await Effect.runPromise(
      readQuestionPreview({
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      })
    );
  }
);
