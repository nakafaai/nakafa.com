// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { THEME_COMPATIBILITY_COLORS } from "@repo/design-system/lib/theme/compatibility";
import { serveManifest as serveManifestEffect } from "@/lib/seo/manifest.server";
import { runServerEffect } from "@/lib/server/fn";

/** Runs the manifest as its route does. */
const serveManifest = () => runServerEffect(serveManifestEffect());

const readServerTranslatorMock = vi.hoisted(() => vi.fn());

vi.mock("@repo/internationalization/src/translator", () => ({
  /** Answers the English metadata copy without reading the request clock. */
  readServerTranslator: readServerTranslatorMock,
}));

describe("web app manifest route", () => {
  it("describes the app with its English description and theme colors", async () => {
    readServerTranslatorMock.mockResolvedValue((key: string) => `copy:${key}`);

    const response = await serveManifest();

    expect(response.headers.get("content-type")).toBe(
      "application/manifest+json"
    );
    await expect(response.json()).resolves.toMatchObject({
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
  });
});
