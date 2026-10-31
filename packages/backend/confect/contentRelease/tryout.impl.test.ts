import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

const tryout = refs.public.contentRelease.tryout;
const LOCALES = ["en", "id", "de"] as const;

describe("contentRelease/tryout", () => {
  it.effect(
    "serves each locale's sitemap and taxonomy from the active assessment catalog",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ entry: true, sets: 2 });
        for (const appLocale of LOCALES) {
          expect(
            yield* world.visitor.query(tryout.sitemapCount, { appLocale })
          ).toEqual({ pageCount: 1, routeCount: 5 });
          expect(
            yield* world.visitor.query(tryout.sitemapPage, {
              appLocale,
              page: 0,
            })
          ).toEqual({
            paths: [
              `try-out/indonesia-${appLocale}`,
              `try-out/indonesia/snbt-${appLocale}`,
              `try-out/indonesia/snbt/2027-${appLocale}`,
              `try-out/indonesia/snbt/2027/set-1-${appLocale}`,
              `try-out/indonesia/snbt/2027/set-2-${appLocale}`,
            ],
          });
          expect(
            yield* world.visitor.query(tryout.taxonomy, { appLocale })
          ).toEqual({
            countries: [{ id: "indonesia", label: "Try-out" }],
            exams: [{ id: "snbt", label: "Try-out" }],
            routeCount: 5,
          });
        }
        for (const page of [-1, 1.5, 1]) {
          expect(
            yield* world.visitor.query(tryout.sitemapPage, {
              appLocale: "id",
              page,
            })
          ).toBeNull();
        }
      })
  );

  it.effect("refuses reads before any release activates a snapshot", () =>
    Effect.gen(function* () {
      const visitor = client(createConvexTestWithBetterAuth());
      expect(
        yield* visitor
          .query(tryout.sitemapCount, { appLocale: "id" })
          .pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_MISSING" });
      expect(
        yield* visitor
          .query(tryout.taxonomy, { appLocale: "id" })
          .pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_MISSING" });
    })
  );
});
