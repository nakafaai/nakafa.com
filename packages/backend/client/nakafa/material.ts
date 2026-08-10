import "server-only";

import {
  type ContentRuntimeTarget,
  readPublicContentEvidence,
} from "@repo/backend/client/content/public";
import { decodeNakafaMarkdown } from "@repo/backend/client/nakafa/decode";
import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { getMaterialLookupInput } from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import { projectMdxForAgentMarkdown } from "@repo/contents/_types/llms/mdx";
import { Effect, Option } from "effect";

type ContentTargetReader = () => ContentRuntimeTarget;

/** Maps one signed-content failure into the shared agent read contract. */
function materialReadError(error: unknown) {
  return new NakafaAgentDataReadError({
    cause: getUnknownErrorMessage(error),
    message: "Unable to read signed Nakafa material content.",
  });
}

/** Reads one active Aksara material through its signed server-only runtime. */
export const readPublishedMaterialMarkdown = Effect.fn(
  "NakafaContent.readPublishedMaterialMarkdown"
)(function* (
  convexUrl: string,
  readContentTarget: ContentTargetReader,
  input: string
) {
  const lookupInput = getMaterialLookupInput(input);
  if (Option.isNone(lookupInput)) {
    return {
      activeReleaseId: undefined,
      managed: false,
      markdown: Option.none(),
    };
  }

  const lookup = yield* readNakafaRuntimeQuery(
    convexUrl,
    api.contentRelease.material.lookup,
    { input: lookupInput.value }
  );
  if (!(lookup.managed && lookup.route)) {
    return {
      activeReleaseId: lookup.activeReleaseId,
      managed: lookup.managed,
      markdown: Option.none(),
    };
  }

  const target = yield* Effect.try({
    try: readContentTarget,
    catch: materialReadError,
  });
  const found = yield* readPublicContentEvidence(target, lookup.route).pipe(
    Effect.mapError(materialReadError)
  );
  if (found.projection.kind !== "subject-lesson") {
    return yield* materialReadError(
      "The signed material route resolved another content family."
    );
  }
  if (found.activeReleaseId !== lookup.activeReleaseId) {
    return yield* materialReadError(
      `Material lookup release ${lookup.activeReleaseId ?? "none"} changed before its signed read returned ${found.activeReleaseId ?? "none"}.`
    );
  }

  const ref = createNakafaContentRefFromGraphProjection({
    ...found.projection.graph,
    content_id: found.projection.graph.assetId,
    locale: found.projection.locale,
    route: found.projection.publicPath,
    section: "material",
  });
  if (Option.isNone(ref)) {
    return yield* materialReadError(
      "The signed material projection has an invalid agent identity."
    );
  }

  const body = yield* projectMdxForAgentMarkdown(
    found.artifact.payload.rawMdx
  ).pipe(Effect.mapError(materialReadError));
  const metadata = found.projection.metadata;
  const markdown = yield* decodeNakafaMarkdown({
    ...ref.value,
    description: metadata.description ?? metadata.subject ?? "",
    text: [`# ${metadata.title}`, "", body.trim()].join("\n"),
    title: metadata.title,
  });

  return {
    activeReleaseId: lookup.activeReleaseId,
    managed: true,
    markdown: Option.some(markdown),
  };
});
