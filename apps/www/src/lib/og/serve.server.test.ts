// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { serveLocaleOgImage, serveOgImage } from "@/lib/og/serve.server";
import { runServerEffect } from "@/lib/server/fn";

const readOgCopyMock = vi.hoisted(() => vi.fn());
const generateOGImageMock = vi.hoisted(() => vi.fn());
const generateFallbackImageMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/og/copy.server", () => ({
  /** Controls the copy that each route names. */
  readOgCopy: readOgCopyMock,
}));

vi.mock("@/lib/og", () => ({
  /** Records the copy that the image renders. */
  generateOGImage: generateOGImageMock,
}));

vi.mock("@/lib/og/fallback", () => ({
  /** Records each brand fallback answer. */
  generateFallbackImage: generateFallbackImageMock,
}));

const COPY = { description: "Belajar aljabar", title: "Aljabar" };

beforeEach(() => {
  readOgCopyMock.mockReset().mockReturnValue(Effect.succeedSome(COPY));
  generateOGImageMock
    .mockReset()
    .mockReturnValue(new Response("image", { status: 200 }));
  generateFallbackImageMock
    .mockReset()
    .mockReturnValue(Effect.succeed(new Response("brand", { status: 404 })));
});

describe("og image route", () => {
  it("renders the copy of a route under its locale and drops the image file name", async () => {
    const response = await runServerEffect(
      serveOgImage({
        params: { _splat: "id/articles/aljabar/image.png" },
      })
    );

    expect(response.status).toBe(200);
    expect(readOgCopyMock).toHaveBeenCalledWith("id", ["articles", "aljabar"]);
    expect(generateOGImageMock).toHaveBeenCalledWith(COPY);
  });

  it("renders the default locale for a route without a locale prefix", async () => {
    await runServerEffect(
      serveOgImage({ params: { _splat: "articles/aljabar" } })
    );

    expect(readOgCopyMock).toHaveBeenCalledWith("en", ["articles", "aljabar"]);
  });

  it("answers the brand fallback when the route names no published content", async () => {
    readOgCopyMock.mockReturnValue(Effect.succeedNone);

    const response = await runServerEffect(
      serveOgImage({
        params: { _splat: "en/articles/unknown" },
      })
    );

    expect(response.status).toBe(404);
    expect(generateFallbackImageMock).toHaveBeenCalledWith("en");
    expect(generateOGImageMock).not.toHaveBeenCalled();
  });

  it("answers the default copy of the root without a splat", async () => {
    await runServerEffect(serveOgImage({ params: {} }));

    expect(readOgCopyMock).toHaveBeenCalledWith("en", []);
  });

  it("answers the brand fallback for an image address under an unserved locale shape", async () => {
    const response = await runServerEffect(
      serveOgImage({
        params: { _splat: "fr/articles/aljabar/image.png" },
      })
    );

    expect(response.status).toBe(404);
    expect(generateFallbackImageMock).toHaveBeenCalledWith("en");
    expect(readOgCopyMock).not.toHaveBeenCalled();
  });

  it("renders the default locale for a path under an unserved locale shape without an image suffix", async () => {
    await runServerEffect(serveOgImage({ params: { _splat: "fr/articles" } }));

    expect(readOgCopyMock).toHaveBeenCalledWith("en", ["fr", "articles"]);
  });
});

describe("localized og image route", () => {
  it("renders the default copy of a localized root without a splat", async () => {
    await runServerEffect(serveLocaleOgImage({ params: { lang: "de" } }));

    expect(readOgCopyMock).toHaveBeenCalledWith("de", []);
  });

  it("renders the copy of a localized route", async () => {
    const response = await runServerEffect(
      serveLocaleOgImage({
        params: { _splat: "articles/aljabar/image.png", lang: "de" },
      })
    );

    expect(response.status).toBe(200);
    expect(readOgCopyMock).toHaveBeenCalledWith("de", ["articles", "aljabar"]);
  });

  it("answers the brand fallback for a locale that the site does not serve", async () => {
    const response = await runServerEffect(
      serveLocaleOgImage({
        params: { _splat: "articles/aljabar", lang: "fr" },
      })
    );

    expect(response.status).toBe(404);
    expect(generateFallbackImageMock).toHaveBeenCalledWith("en");
    expect(readOgCopyMock).not.toHaveBeenCalled();
  });

  it("answers the brand fallback when the localized route names no content", async () => {
    readOgCopyMock.mockReturnValue(Effect.succeedNone);

    const response = await runServerEffect(
      serveLocaleOgImage({
        params: { _splat: "missing", lang: "id" },
      })
    );

    expect(response.status).toBe(404);
    expect(generateFallbackImageMock).toHaveBeenCalledWith("id");
  });
});
