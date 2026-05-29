import type { PersistedProviderMetadata } from "@repo/backend/convex/chats/schema";
import type { ProviderMetadata } from "ai";

/** Keeps only provider metadata values that the chat transcript must replay. */
export function toPersistedProviderMetadata(
  metadata: ProviderMetadata | undefined
) {
  if (!metadata) {
    return;
  }

  const persisted: PersistedProviderMetadata = {};

  for (const [provider, entries] of Object.entries(metadata)) {
    const persistedEntries: PersistedProviderMetadata[string] = {};

    for (const [key, value] of Object.entries(entries)) {
      if (typeof value === "string") {
        persistedEntries[key] = value;
      }
    }

    if (Object.keys(persistedEntries).length > 0) {
      persisted[provider] = persistedEntries;
    }
  }

  if (Object.keys(persisted).length === 0) {
    return;
  }

  return persisted;
}
