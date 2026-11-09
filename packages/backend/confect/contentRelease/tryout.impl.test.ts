import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { client } from "@repo/backend/test/client";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Order } from "effect";

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
          ).toEqual({ pageCount: 1, routeCount: 4 });
          expect(
            yield* world.visitor.query(tryout.sitemapPage, {
              appLocale,
              page: 0,
            })
          ).toEqual({
            // The year's one track is entered straight away, so the year is
            // not a page of its own; the country is always its exams' page.
            paths: [
              `try-out/indonesia-${appLocale}`,
              `try-out/indonesia/snbt/2027/utbk-${appLocale}`,
              `try-out/indonesia/snbt/2027/utbk/set-1-${appLocale}`,
              `try-out/indonesia/snbt/2027/utbk/set-2-${appLocale}`,
            ],
          });
          expect(
            yield* world.visitor.query(tryout.taxonomy, { appLocale })
          ).toEqual({
            countries: [{ id: "indonesia", label: "Try-out" }],
            exams: [{ id: "snbt", label: "Try-out" }],
            routeCount: 4,
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

  it.effect(
    "lists a group as a page once it offers a real choice",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ paired: true });
        const page = yield* world.visitor.query(tryout.sitemapPage, {
          appLocale: "id",
          page: 0,
        });
        expect(Arr.sort(page?.paths ?? [], Order.String)).toEqual(
          Arr.sort(
            [
              "try-out/indonesia-id",
              "try-out/indonesia/snbt/2027-id",
              "try-out/indonesia/snbt/2027/paired-id",
              "try-out/indonesia/snbt/2027/utbk-id",
              "try-out/indonesia/snbt/2027/utbk/set-1-id",
              "try-out/indonesia/snbt/2027/utbk/set-1-id/section-a",
              "try-out/indonesia/snbt/2027/utbk/set-1-id/section-b",
            ],
            Order.String
          )
        );
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
