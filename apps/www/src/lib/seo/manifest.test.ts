// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import { readManifestText } from "@/lib/seo/manifest";

const readServerTranslatorMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/internationalization/src/translator", () => ({
  /** Answers the English metadata copy without reading the request clock. */
  readServerTranslator: readServerTranslatorMock,
}));

describe("web app manifest text", () => {
  it.effect(
    "describes the app with its English description and theme colors",
    () =>
      Effect.gen(function* () {
        readServerTranslatorMock.mockResolvedValue(
          (key: string) => `copy:${key}`
        );

        const text = yield* readManifestText();

        expect(yield* Schema.decodeEffect(JsonTextSchema)(text)).toMatchObject({
          name: "Nakafa",
          description: "copy:description",
          background_color: THEME_COMPATIBILITY_COLORS.light.background,
          theme_color: THEME_COMPATIBILITY_COLORS.light.background,
          start_url: "/",
        });
        expect(readServerTranslatorMock).toHaveBeenCalledWith({
          locale: "en",
          namespace: "Metadata",
        });
      })
  );
});
