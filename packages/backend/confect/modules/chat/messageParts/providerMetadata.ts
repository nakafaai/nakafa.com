import { failMessagePart } from "@repo/backend/confect/modules/chat/messageParts/shared";
import { providerMetadataSchema } from "@repo/backend/confect/modules/chat/providerMetadata.schemas";
import type { ProviderMetadata } from "ai";
import { Option, Schema } from "effect";

type PersistedProviderMetadata = Schema.Schema.Type<
  typeof providerMetadataSchema
>;
type PersistedGroundingProvider = NonNullable<
  PersistedProviderMetadata["google"]
>;
type PersistedGroundingMetadata = NonNullable<
  NonNullable<PersistedGroundingProvider["groundingMetadata"]>
>;

/** Copies optional string arrays into mutable Convex-ready arrays. */
function copyStrings(items: readonly string[] | null | undefined) {
  if (items === undefined) {
    return;
  }

  if (items === null) {
    return null;
  }

  return [...items];
}

/** Copies Google grounding chunks into mutable Convex-ready objects. */
function copyGroundingChunks(
  chunks: PersistedGroundingMetadata["groundingChunks"]
) {
  if (chunks === undefined) {
    return;
  }

  if (chunks === null) {
    return null;
  }

  return chunks.map((chunk) => {
    if (!chunk.web) {
      return {};
    }

    if (chunk.web.title === undefined) {
      return { web: { uri: chunk.web.uri } };
    }

    return { web: { title: chunk.web.title, uri: chunk.web.uri } };
  });
}

/** Copies one grounding metadata payload into the persisted shape. */
function copyGroundingMetadata(metadata: PersistedGroundingMetadata) {
  return {
    groundingChunks: copyGroundingChunks(metadata.groundingChunks),
    webSearchQueries: copyStrings(metadata.webSearchQueries),
  };
}

/** Copies one provider payload into the persisted shape. */
function copyGroundingProvider(
  provider: PersistedGroundingProvider | undefined
) {
  if (provider === undefined) {
    return;
  }

  if (provider.groundingMetadata === undefined) {
    return {};
  }

  if (provider.groundingMetadata === null) {
    return { groundingMetadata: null };
  }

  return {
    groundingMetadata: copyGroundingMetadata(provider.groundingMetadata),
  };
}

/** Copies provider metadata into a mutable persisted object. */
function copyProviderMetadata(metadata: PersistedProviderMetadata) {
  const google = copyGroundingProvider(metadata.google);
  const vertex = copyGroundingProvider(metadata.vertex);

  return {
    ...(google === undefined ? {} : { google }),
    ...(vertex === undefined ? {} : { vertex }),
  };
}

/** Validates AI SDK provider metadata before storing it in Convex. */
export function persistProviderMetadata(
  metadata: ProviderMetadata | undefined
) {
  if (metadata === undefined) {
    return;
  }

  const decoded = Schema.decodeUnknownOption(providerMetadataSchema)(metadata);

  if (Option.isNone(decoded)) {
    return failMessagePart(
      "Provider metadata is not supported for persistence."
    );
  }

  return copyProviderMetadata(decoded.value);
}

/** Restores persisted provider metadata for AI SDK UI messages. */
export function restoreProviderMetadata(
  metadata: PersistedProviderMetadata | undefined
) {
  if (metadata === undefined) {
    return;
  }

  const copied = copyProviderMetadata(metadata);
  const restored: ProviderMetadata = {};

  if (copied.google) {
    restored.google = copied.google;
  }

  if (copied.vertex) {
    restored.vertex = copied.vertex;
  }

  return restored;
}
