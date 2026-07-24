import { readPublicContent } from "@repo/backend/client/content/read";
import type { PublicContentTarget } from "@repo/backend/client/content/request";
import { decodeNakafaMarkdown } from "@repo/backend/client/nakafa/decode";
import { readQuranMarkdown } from "@repo/backend/client/nakafa/quran";
import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import type { NakafaAgentMarkdown } from "@repo/contents/_lib/agent/schema/read";
import type { NakafaAgentContentRef } from "@repo/contents/_lib/agent/schema/ref";
import { projectMdxForAgentMarkdown } from "@repo/contents/_types/llms/mdx";
import { Effect, Option } from "effect";

/** Reads full markdown for one normalized Nakafa content reference. */
export const readNakafaMarkdown = Effect.fn("NakafaContent.readMarkdown")(
  function* (
    convexUrl: string,
    contentTarget: PublicContentTarget,
    input: string
  ) {
    const ref = yield* resolveNakafaContentRef(convexUrl, input);

    if (Option.isNone(ref)) {
      return Option.none<NakafaAgentMarkdown>();
    }

    if (ref.value.section === "quran") {
      return yield* readQuranMarkdown(convexUrl, ref.value);
    }

    return yield* readMdxMarkdown(contentTarget, ref.value);
  }
);

/** Reads one public article or material through the signed runtime seam. */
export const readMdxMarkdown = Effect.fn("NakafaContent.readMdxMarkdown")(
  function* (contentTarget: PublicContentTarget, ref: NakafaAgentContentRef) {
    if (ref.section !== "articles" && ref.section !== "material") {
      return Option.none<NakafaAgentMarkdown>();
    }

    const found = yield* readPublicContent(contentTarget, {
      locale: ref.locale,
      publicPath: ref.route,
    }).pipe(
      Effect.map(Option.some),
      Effect.catchTag("PublicContentMissingError", () =>
        Effect.succeed(Option.none())
      ),
      Effect.mapError(toAgentReadError)
    );

    if (Option.isNone(found)) {
      return Option.none<NakafaAgentMarkdown>();
    }
    const { artifact, projection } = found.value;
    if (
      (ref.section === "articles" && projection.kind !== "article") ||
      (ref.section === "material" && projection.kind !== "subject-lesson")
    ) {
      return yield* new NakafaAgentDataReadError({
        cause: "Signed projection family does not match the route catalog.",
        message: "Unable to read Nakafa signed content.",
      });
    }

    const body = yield* projectMdxForAgentMarkdown(
      artifact.payload.rawMdx
    ).pipe(Effect.mapError(toAgentReadError));
    const markdown = yield* decodeNakafaMarkdown({
      ...ref,
      description: getMdxDescription(projection.metadata),
      text: [`# ${projection.metadata.title}`, "", body].join("\n"),
      title: projection.metadata.title,
    });

    return Option.some(markdown);
  }
);

/** Returns the best agent-facing description from signed metadata. */
function getMdxDescription(metadata: {
  readonly description?: string;
  readonly subject?: string;
}) {
  if (metadata.description) {
    return metadata.description;
  }

  return metadata.subject ?? "";
}

/** Sanitizes one signed-content failure for the public agent error channel. */
function toAgentReadError(error: unknown) {
  return new NakafaAgentDataReadError({
    cause: getUnknownErrorMessage(error),
    message: "Unable to read Nakafa signed content.",
  });
}
