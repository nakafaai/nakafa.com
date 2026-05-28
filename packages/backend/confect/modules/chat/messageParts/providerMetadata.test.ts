import { describe, expect, it } from "@effect/vitest";
import {
  persistProviderMetadata,
  restoreProviderMetadata,
} from "@repo/backend/confect/modules/chat/messageParts/providerMetadata";
import {
  requirePartField,
  requireToolState,
} from "@repo/backend/confect/modules/chat/messageParts/shared";
import { Effect } from "effect";

describe("provider metadata persistence", () => {
  it.effect("returns undefined when provider metadata is absent", () =>
    Effect.sync(() => {
      expect(persistProviderMetadata(undefined)).toBeUndefined();
      expect(restoreProviderMetadata(undefined)).toBeUndefined();
    })
  );
  it.effect("round trips supported provider metadata", () =>
    Effect.sync(() => {
      const metadata = {
        anthropic: { signature: "anthropic-signature" },
        azure: {
          itemId: "rs_123",
          reasoningEncryptedContent: "encrypted-reasoning",
        },
        gateway: { generationId: "gen_123" },
        google: {
          groundingMetadata: {
            groundingChunks: [
              {},
              { web: { uri: "https://nakafa.com" } },
              { web: { title: "Nakafa", uri: "https://nakafa.com/id" } },
            ],
            webSearchQueries: ["nakafa"],
          },
          thoughtSignature: "google-signature",
        },
        vertex: {
          groundingMetadata: null,
          thoughtSignature: "vertex-signature",
        },
      };
      expect(
        restoreProviderMetadata(persistProviderMetadata(metadata))
      ).toEqual(metadata);
    })
  );
  it.effect("keeps empty, null, and omitted provider fields explicit", () =>
    Effect.sync(() => {
      expect(persistProviderMetadata({})).toEqual({});
      expect(restoreProviderMetadata({})).toEqual({});
      expect(
        persistProviderMetadata({ azure: { itemId: "rs_no_reasoning" } })
      ).toEqual({ azure: { itemId: "rs_no_reasoning" } });
      expect(
        persistProviderMetadata({
          gateway: {},
          google: {
            groundingMetadata: {
              groundingChunks: null,
              webSearchQueries: null,
            },
          },
          vertex: {},
        })
      ).toEqual({
        gateway: {},
        google: {
          groundingMetadata: {
            groundingChunks: null,
            webSearchQueries: null,
          },
        },
        vertex: {},
      });
      expect(
        persistProviderMetadata({
          google: { groundingMetadata: {} },
        })
      ).toEqual({
        google: {
          groundingMetadata: {
            groundingChunks: undefined,
            webSearchQueries: undefined,
          },
        },
      });
    })
  );
  it.effect("rejects unsupported provider metadata", () =>
    Effect.sync(() => {
      expect(() => persistProviderMetadata({ azure: { itemId: 123 } })).toThrow(
        "Provider metadata is not supported for persistence."
      );
    })
  );
});
describe("message part field requirements", () => {
  it.effect("returns present required fields", () =>
    Effect.sync(() => {
      expect(
        requirePartField({
          fieldName: "toolState",
          partType: "tool-math",
          value: "input-available",
        })
      ).toBe("input-available");
    })
  );
  it.effect("fails readable errors for missing required fields", () =>
    Effect.sync(() => {
      expect(() =>
        requirePartField({
          fieldName: "toolState",
          partType: "tool-math",
          value: undefined,
        })
      ).toThrow(
        "Required field 'toolState' is missing for part type 'tool-math'."
      );
    })
  );
  it.effect("returns present tool states from persisted parts", () =>
    Effect.sync(() => {
      expect(
        requireToolState({ toolState: "output-available", type: "tool-math" })
      ).toBe("output-available");
    })
  );
  it.effect("fails readable errors for missing persisted tool states", () =>
    Effect.sync(() => {
      expect(() =>
        requireToolState({ toolState: undefined, type: "tool-math" })
      ).toThrow(
        "Required field 'toolState' is missing for part type 'tool-math'."
      );
    })
  );
});
