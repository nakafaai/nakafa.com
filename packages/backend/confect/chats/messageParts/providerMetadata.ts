/** Keeps only provider metadata values that the chat transcript must replay. */
import type { PersistedProviderMetadata } from "@repo/backend/confect/chats/schema";
import type { ProviderMetadata } from "ai";
/** Keeps only provider metadata values that the chat transcript must replay. */
export function toPersistedProviderMetadata(
  metadata: ProviderMetadata | undefined
) {
  if (!metadata) {
    return;
  }
  const persisted = Object.fromEntries(
    Object.entries(metadata).flatMap(
      ([provider, entries]): [string, PersistedProviderMetadata[string]][] => {
        const strings = Object.entries(entries).flatMap(
          ([key, value]): [string, string][] =>
            typeof value === "string" ? [[key, value]] : []
        );
        return strings.length === 0
          ? []
          : [[provider, Object.fromEntries(strings)]];
      }
    )
  );
  if (Object.keys(persisted).length === 0) {
    return;
  }
  return persisted;
}
