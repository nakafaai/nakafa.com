import type { GetContentInput } from "@repo/ai/agents/content/schema";
import type { AgentContext } from "@repo/ai/types/agents";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect } from "effect";

/**
 * Chooses the server-verified page input for the first required page fetch.
 */
export const resolveMaterialInput = Effect.fn("content.resolveMaterialInput")(
  function* ({
    context,
    input,
    locale,
    usePageInput,
  }: {
    context: AgentContext;
    input: GetContentInput;
    locale: Locale;
    usePageInput: boolean;
  }) {
    if (!usePageInput) {
      return input;
    }

    return yield* Effect.succeed({ locale, slug: context.slug });
  }
);

/**
 * Removes a duplicated locale prefix from the model or server slug.
 */
export const normalizeMaterialSlug = Effect.fn("content.normalizeMaterialSlug")(
  function* ({ slug, locale }: { slug: string; locale: Locale }) {
    const cleanedSlug = yield* Effect.sync(() => cleanSlug(slug));

    if (cleanedSlug === locale) {
      return "";
    }

    if (!cleanedSlug.startsWith(`${locale}/`)) {
      return cleanedSlug;
    }

    return cleanedSlug.slice(locale.length + 1);
  }
);
