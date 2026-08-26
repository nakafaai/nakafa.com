// @vitest-environment node

import {
  hasRequestBody,
  readContentInput,
  readQuranInput,
  readSearchInput,
  readTaxonomyInput,
} from "@repo/backend/convex/routes/agent/input";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

function url(path: string) {
  return new URL(path, "https://api.nakafa.com");
}

describe("agent HTTP input", () => {
  it.effect("reads exact search and taxonomy parameters", () =>
    Effect.gen(function* () {
      expect(
        yield* readSearchInput(
          url(
            "/v1/search?query=linear&query=equation&locale=id&section=material&limit=5&offset=1"
          )
        )
      ).toEqual({
        limit: 5,
        locale: "id",
        offset: 1,
        queries: ["linear", "equation"],
        section: "material",
      });
      expect(yield* readSearchInput(url("/v1/search"))).toEqual({});
      expect(yield* readTaxonomyInput(url("/v1/taxonomy?locale=de"))).toEqual({
        locale: "de",
      });
      expect(yield* readTaxonomyInput(url("/v1/taxonomy"))).toEqual({});
    })
  );

  it.effect("reads exact content and Quran parameters", () =>
    Effect.gen(function* () {
      expect(
        yield* readContentInput(
          url("/v1/content?ref=asset%3Aexample%3Amaterial%3Aalgebra")
        )
      ).toBe("asset:example:material:algebra");
      expect(
        yield* readQuranInput(
          url(
            "/v1/quran/2?from_verse=1&to_verse=3&locale=id&include_tafsir=true"
          ),
          "2"
        )
      ).toEqual({
        from_verse: 1,
        include_tafsir: true,
        locale: "id",
        surah: 2,
        to_verse: 3,
      });
      expect(yield* readQuranInput(url("/v1/quran/1"), "1")).toEqual({
        surah: 1,
      });
    })
  );

  it.effect("rejects missing, repeated, unknown, and malformed values", () =>
    Effect.gen(function* () {
      const failures = yield* Effect.all({
        duplicate: readSearchInput(url("/v1/search?locale=en&locale=id")).pipe(
          Effect.flip
        ),
        invalidBoolean: readQuranInput(
          url("/v1/quran/1?include_tafsir=yes"),
          "1"
        ).pipe(Effect.flip),
        invalidInteger: readSearchInput(url("/v1/search?limit=1.5")).pipe(
          Effect.flip
        ),
        invalidPath: readQuranInput(
          url("/v1/quran/not-a-number"),
          "not-a-number"
        ).pipe(Effect.flip),
        missing: readContentInput(url("/v1/content")).pipe(Effect.flip),
        unknown: readSearchInput(url("/v1/search?unknown=value")).pipe(
          Effect.flip
        ),
      });
      for (const failure of Object.values(failures)) {
        expect(failure).toMatchObject({
          _tag: "AgentHttpInputError",
        });
      }
    })
  );

  it("recognizes only requests with a body or invalid declared length", () => {
    expect(hasRequestBody(new Request("https://api.nakafa.com/v1"))).toBe(
      false
    );
    expect(
      hasRequestBody(
        new Request("https://api.nakafa.com/v1", {
          headers: { "content-length": "1" },
        })
      )
    ).toBe(true);
    expect(
      hasRequestBody(
        new Request("https://api.nakafa.com/v1", {
          headers: { "content-length": "invalid" },
        })
      )
    ).toBe(true);
    expect(
      hasRequestBody(
        new Request("https://api.nakafa.com/v1", {
          body: "{}",
          method: "POST",
        })
      )
    ).toBe(true);
  });
});
