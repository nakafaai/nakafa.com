import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import {
  quranMarkdownValidator,
  readQuranMarkdown,
} from "@repo/backend/content/quran/markdown";
import { readContentReference } from "@repo/backend/content/reference/read";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import { contentSearchSummaryValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { v } from "convex/values";
import { Effect, Layer, Option, Schema } from "effect";

/** One transactionally consistent source for an agent focused read. */
export const agentContentSourceValidator = v.union(
  v.object({
    kind: v.literal("reference"),
    reference: contentSearchSummaryValidator,
  }),
  v.object({
    kind: v.literal("quran"),
    markdown: quranMarkdownValidator,
    reference: contentSearchSummaryValidator,
    surahNumber: v.number(),
  }),
  v.null()
);

/** Reads one reference and any Quran body from the same database snapshot. */
export const readAgentContentSource = Effect.fn(
  "contentRelease.readAgentContentSource"
)(function* (ctx: QueryCtx, input: ContentReferenceInput) {
  const reference = yield* readContentReference(input).pipe(
    Effect.provide(
      Layer.mergeAll(
        convexArticleLayer(ctx),
        convexMaterialLayer(ctx),
        convexQuranLayer(ctx),
        convexTryoutLayer(ctx)
      )
    )
  );
  if (reference === null) {
    return null;
  }
  if (reference.section !== "quran") {
    return { kind: "reference" as const, reference };
  }
  const surahNumber = yield* parseQuranRoute(reference.route);
  const markdown = yield* readQuranMarkdown(reference.locale, surahNumber).pipe(
    Effect.provide(convexQuranLayer(ctx))
  );
  return { kind: "quran" as const, markdown, reference, surahNumber };
});

/** Parses one canonical Quran route from an authenticated reference. */
const parseQuranRoute = Effect.fn("contentRelease.parseAgentQuranRoute")(
  function* (route: string) {
    const [section, value, extra] = route.split("/");
    const decoded = Schema.decodeOption(QuranSurahNumberSchema)(Number(value));
    if (
      section !== "quran" ||
      extra !== undefined ||
      Option.isNone(decoded) ||
      route !== `quran/${decoded.value}`
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "The active Quran reference has an invalid route identity."
      );
    }
    return decoded.value;
  }
);
