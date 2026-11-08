import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { FIXTURE_REVISION } from "@repo/backend/test/assessment/snapshot";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

const catalog = tryouts.queries.catalog;

describe("content/tryout/navigation", () => {
  it.effect(
    "navigates the hub, a country, an exam, a group, and a track with the revision of their catalog",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const args = (publicPath: string) => ({
          appLocale: "id" as const,
          publicPath,
        });
        expect(
          yield* world.visitor.query(catalog.getHubPage, { appLocale: "id" })
        ).toEqual({
          countries: [
            {
              countryCode: "ID",
              countryKey: "indonesia",
              description: "Try-out Indonesia",
              examCount: 1,
              publicPath: "try-out/indonesia-id",
              title: "Try-out",
            },
          ],
          sourceRevision: FIXTURE_REVISION,
        });
        expect(
          yield* world.visitor.query(
            catalog.getCountryPage,
            args("try-out/indonesia-id")
          )
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exams: [
            {
              entryPath: "try-out/indonesia/snbt/2027-id",
              examKey: "snbt",
              groupAxis: "year",
              publicPath: "try-out/indonesia/snbt-id",
            },
          ],
          sourceRevision: FIXTURE_REVISION,
        });
        const group = {
          groupKey: "2027",
          publicPath: "try-out/indonesia/snbt/2027-id",
        };
        expect(
          yield* world.visitor.query(
            catalog.getExamPage,
            args("try-out/indonesia/snbt-id")
          )
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exam: { examKey: "snbt", groupAxis: "year" },
          groups: [group],
        });
        expect(
          yield* world.visitor.query(
            catalog.getGroupPage,
            args("try-out/indonesia/snbt/2027-id")
          )
        ).toMatchObject({
          exam: { examKey: "snbt" },
          group,
          groups: [group],
          tracks: [{ groupKey: "2027", trackKey: "2027" }],
        });
        expect(
          yield* world.visitor.query(
            catalog.getTrackPage,
            args("try-out/indonesia/snbt/2027/utbk-id")
          )
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exam: { examKey: "snbt" },
          group,
          groups: [group],
          track: { groupKey: "2027", trackKey: "2027" },
        });
        for (const ref of [
          catalog.getCountryPage,
          catalog.getExamPage,
          catalog.getGroupPage,
          catalog.getTrackPage,
          catalog.getSetPage,
          catalog.getSectionPage,
        ]) {
          expect(
            yield* world.visitor.query(ref, {
              appLocale: "id",
              publicPath: "try-out/nowhere",
            })
          ).toBeNull();
        }
      })
  );
});
