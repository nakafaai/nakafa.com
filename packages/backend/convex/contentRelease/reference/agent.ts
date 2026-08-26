import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  quranMarkdownValidator,
  readQuranMarkdown,
} from "@repo/backend/convex/contentRelease/quran/markdown";
import { readContentReference } from "@repo/backend/convex/contentRelease/reference/read";
import {
  type ContentReferenceInput,
  contentReferenceInputValidator,
} from "@repo/backend/convex/contentRelease/reference/spec";
import { contentSearchSummaryValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect, Option, Schema } from "effect";

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
  const reference = yield* readContentReference(ctx, input);
  if (reference === null) {
    return null;
  }
  if (reference.section !== "quran") {
    return { kind: "reference" as const, reference };
  }
  const surahNumber = yield* parseQuranRoute(reference.route);
  const markdown = yield* readQuranMarkdown(ctx, reference.locale, surahNumber);
  return { kind: "quran" as const, markdown, reference, surahNumber };
});

/** Internal query used by the protected agent HTTP action. */
export const read = internalQuery({
  args: { input: contentReferenceInputValidator },
  returns: agentContentSourceValidator,
  handler: (ctx, { input }) =>
    runConvexProgram(readAgentContentSource(ctx, input)),
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
