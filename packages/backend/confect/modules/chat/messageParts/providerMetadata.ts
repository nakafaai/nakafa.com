import { failMessagePart } from "@repo/backend/confect/modules/chat/messageParts/shared";
import { providerMetadataSchema } from "@repo/backend/confect/modules/chat/providerMetadata.schemas";
import type { ProviderMetadata } from "ai";
import { Option, Schema } from "effect";

type PersistedProviderMetadata = Schema.Schema.Type<
  typeof providerMetadataSchema
>;
type PersistedAnthropicProvider = NonNullable<
  PersistedProviderMetadata["anthropic"]
>;
type PersistedAzureProvider = NonNullable<PersistedProviderMetadata["azure"]>;
type PersistedGroundingProvider = NonNullable<
  PersistedProviderMetadata["google"]
>;
type PersistedGatewayProvider = NonNullable<
  PersistedProviderMetadata["gateway"]
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

  const signature =
    provider.thoughtSignature === undefined
      ? {}
      : { thoughtSignature: provider.thoughtSignature };

  if (provider.groundingMetadata === undefined) {
    return signature;
  }

  if (provider.groundingMetadata === null) {
    return { ...signature, groundingMetadata: null };
  }

  return {
    ...signature,
    groundingMetadata: copyGroundingMetadata(provider.groundingMetadata),
  };
}

/** Copies AI Gateway response metadata into the persisted shape. */
function copyGatewayProvider(provider: PersistedGatewayProvider | undefined) {
  if (provider === undefined) {
    return;
  }

  if (provider.generationId === undefined) {
    return {};
  }

  return { generationId: provider.generationId };
}

/** Copies Azure response metadata into the persisted shape. */
function copyAzureProvider(provider: PersistedAzureProvider | undefined) {
  if (provider === undefined) {
    return;
  }

  if (provider.reasoningEncryptedContent === undefined) {
    return { itemId: provider.itemId };
  }

  return {
    itemId: provider.itemId,
    reasoningEncryptedContent: provider.reasoningEncryptedContent,
  };
}

/** Copies Anthropic response metadata into the persisted shape. */
function copyAnthropicProvider(
  provider: PersistedAnthropicProvider | undefined
) {
  if (provider === undefined) {
    return;
  }

  return { signature: provider.signature };
}

/** Copies provider metadata into a mutable persisted object. */
function copyProviderMetadata(metadata: PersistedProviderMetadata) {
  const anthropic = copyAnthropicProvider(metadata.anthropic);
  const azure = copyAzureProvider(metadata.azure);
  const gateway = copyGatewayProvider(metadata.gateway);
  const google = copyGroundingProvider(metadata.google);
  const vertex = copyGroundingProvider(metadata.vertex);

  return {
    ...(anthropic === undefined ? {} : { anthropic }),
    ...(azure === undefined ? {} : { azure }),
    ...(gateway === undefined ? {} : { gateway }),
    ...(google === undefined ? {} : { google }),
    ...(vertex === undefined ? {} : { vertex }),
  };
}

/** Validates AI SDK provider metadata before storing it in Convex. */
export function persistProviderMetadata(metadata: unknown | undefined) {
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

  if (copied.anthropic) {
    restored.anthropic = copied.anthropic;
  }

  if (copied.azure) {
    restored.azure = copied.azure;
  }

  if (copied.gateway) {
    restored.gateway = copied.gateway;
  }

  if (copied.google) {
    restored.google = copied.google;
  }

  if (copied.vertex) {
    restored.vertex = copied.vertex;
  }

  return restored;
}
