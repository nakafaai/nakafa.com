// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";
import { MissingLocalizedRouteProjectionError } from "@/lib/routing/locale/missing";
import { serveLocalizedHref } from "@/lib/routing/locale/route.server";

const resolveLocalizedNavigationHrefMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/routing/locale/resolve", () => ({
  /** Controls the projected href and the typed failures of one resolution. */
  resolveLocalizedNavigationHref: resolveLocalizedNavigationHrefMock,
}));

/** The typed failure of an href that cannot be parsed as a URL. */
class InvalidLocalizedHrefError extends Data.TaggedError(
  "InvalidLocalizedHrefError"
)<{ cause: unknown; href: string }> {}

/** Creates one locale endpoint request for the given query. */
function localeRequest(query: string) {
  return serveLocalizedHref({
    request: new Request(
      `https://nakafa.com/api/internal/routing/locale?${query}`
    ),
  });
}

describe("localized href route", () => {
  it("answers the projected href of the selected locale", async () => {
    resolveLocalizedNavigationHrefMock.mockReturnValue(
      Effect.succeed("/id/materi/matematika")
    );

    const response = await localeRequest(
      "href=%2Fen%2Fmaterials%2Fmath&locale=id"
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      href: "/id/materi/matematika",
    });
    expect(resolveLocalizedNavigationHrefMock).toHaveBeenCalledWith({
      href: "/en/materials/math",
      locale: "id",
    });
  });

  it("answers 400 when the href or the locale is missing", async () => {
    const noHref = await localeRequest("locale=id");
    const noLocale = await localeRequest("href=%2Fen");
    const unknownLocale = await localeRequest("href=%2Fen&locale=fr");

    for (const response of [noHref, noLocale, unknownLocale]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid locale route request",
      });
    }
    expect(resolveLocalizedNavigationHrefMock).not.toHaveBeenCalled();
  });

  it("answers 400 for an href that cannot be parsed", async () => {
    resolveLocalizedNavigationHrefMock.mockReturnValue(
      Effect.fail(new InvalidLocalizedHrefError({ cause: "bad", href: "x" }))
    );

    const response = await localeRequest("href=%5B&locale=en");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid href" });
  });

  it("answers 404 with the path when the locale has no projection", async () => {
    resolveLocalizedNavigationHrefMock.mockReturnValue(
      Effect.fail(
        new MissingLocalizedRouteProjectionError({
          locale: "en",
          publicPath: "materials/math",
        })
      )
    );

    const response = await localeRequest(
      "href=%2Fen%2Fmaterials%2Fmath&locale=de"
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Missing localized route projection",
      path: "materials/math",
    });
  });
});
