import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type ContentRuntimeTarget,
  readPublicContentEvidence,
} from "@repo/backend/client/content/public";
import { decodeNakafaMarkdown } from "@repo/backend/client/nakafa/decode";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/agent/errors";
import type { NakafaAgentContentRef } from "@repo/contents/agent/schema/ref";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { Effect, Option, Schema } from "effect";

type PublishedSection = Extract<
  NakafaAgentContentRef["section"],
  "articles" | "material"
>;
/** Maps one signed-publication failure into the agent read contract. */
function publishedReadError(error: unknown) {
  return new NakafaAgentDataReadError({
    cause: getUnknownErrorMessage(error),
    message: "Unable to read signed Nakafa public content.",
  });
}
/** Reads one current article or material from the signed Aksara runtime. */
export const readPublishedMarkdown = Effect.fn(
  "NakafaContent.readPublishedMarkdown"
)(function* (
  readContentTarget: () => ContentRuntimeTarget,
  ref: NakafaAgentContentRef & {
    readonly section: PublishedSection;
  }
) {
  const target = yield* Effect.try({
    try: readContentTarget,
    catch: publishedReadError,
  });
  const appLocale = yield* Schema.decodeEffect(AppLocaleSchema)(
    ref.locale
  ).pipe(Effect.mapError(publishedReadError));
  const found = yield* readPublicContentEvidence(target, {
    appLocale,
    publicPath: ref.route,
  }).pipe(Effect.mapError(publishedReadError));
  const expectedKind =
    ref.section === "articles" ? "article" : "subject-lesson";
  if (
    found.projection.kind !== expectedKind ||
    found.projection.graph.assetId !== ref.content_id
  ) {
    return yield* publishedReadError(
      "The signed projection changed its requested public identity."
    );
  }
  const body = yield* projectMdxForAgentMarkdown(
    found.artifact.payload.rawMdx
  ).pipe(Effect.mapError(publishedReadError));
  const metadata = found.projection.metadata;
  const description =
    metadata.description ??
    ("subject" in metadata ? metadata.subject : undefined);
  const markdown = yield* decodeNakafaMarkdown({
    ...ref,
    ...(description === undefined ? {} : { description }),
    text: [`# ${metadata.title}`, "", body.trim()].join("\n"),
    title: metadata.title,
  });
  return Option.some(markdown);
});
