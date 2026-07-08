import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import { NakafaAgentMarkdownSchema } from "@repo/contents/_lib/agent/schema/read";
import { NakafaAgentTaxonomySchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { Effect, Schema } from "effect";

/** Decodes agent markdown output into the public schema shape. */
export function decodeNakafaMarkdown(markdown: unknown) {
  return Schema.decodeUnknown(NakafaAgentMarkdownSchema)(markdown).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message: "Unable to build Nakafa agent markdown.",
        })
    )
  );
}

/** Decodes Quran reference output into the public schema shape. */
export function decodeNakafaQuranReference(reference: unknown) {
  return Schema.decodeUnknown(NakafaAgentQuranReferenceSchema)(reference).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message: "Unable to build Nakafa Quran reference.",
        })
    )
  );
}

/** Decodes taxonomy output into the public schema shape. */
export function decodeNakafaTaxonomy(taxonomy: unknown) {
  return Schema.decodeUnknown(NakafaAgentTaxonomySchema)(taxonomy).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentDataReadError({
          cause: getUnknownErrorMessage(error),
          message: "Unable to build Nakafa agent taxonomy.",
        })
    )
  );
}

/** Parses Quran reference options with schema-backed input errors. */
export function parseQuranReferenceOptions(input: unknown) {
  return Schema.decodeUnknown(NakafaAgentQuranReferenceOptionsSchema)(
    input
  ).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentInputError({
          cause: getUnknownErrorMessage(error),
          message: "Invalid Nakafa Quran reference options.",
        })
    )
  );
}
