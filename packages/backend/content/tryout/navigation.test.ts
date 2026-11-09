import { describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { FIXTURE_REVISION } from "@repo/backend/test/assessment/snapshot";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect } from "effect";

const catalog = tryouts.queries.catalog;
const GROUP_PATH = "try-out/indonesia/snbt/2027-id";
const TRACK_PATH = "try-out/indonesia/snbt/2027/utbk-id";

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
              entryPath: TRACK_PATH,
              examKey: "snbt",
              groupAxis: "year",
              publicPath: "try-out/indonesia/snbt-id",
            },
          ],
          sourceRevision: FIXTURE_REVISION,
        });
        const group = {
          groupKey: "2027",
          publicPath: GROUP_PATH,
        };
        const choice = { ...group, entryPath: TRACK_PATH };
        expect(
          yield* world.visitor.query(
            catalog.getExamPage,
            args("try-out/indonesia/snbt-id")
          )
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exam: { examKey: "snbt", groupAxis: "year" },
          groups: [choice],
        });
        expect(
          yield* world.visitor.query(
            catalog.getGroupPage,
            args("try-out/indonesia/snbt/2027-id")
          )
        ).toMatchObject({
          exam: { examKey: "snbt" },
          group,
          groups: [choice],
          tracks: [{ groupKey: "2027", trackKey: "2027" }],
        });
        expect(
          yield* world.visitor.query(catalog.getTrackPage, args(TRACK_PATH))
        ).toMatchObject({
          country: { countryKey: "indonesia" },
          exam: { examKey: "snbt" },
          group,
          groups: [choice],
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

  it.effect(
    "reaches every set table of an exam's first group in at most two clicks from its country page",
    () =>
      Effect.gen(function* () {
        for (const paired of [false, true]) {
          const world = yield* tryoutWorld({ paired });
          const country = yield* world.visitor.query(catalog.getCountryPage, {
            appLocale: "id",
            publicPath: "try-out/indonesia-id",
          });
          const exams = country?.exams ?? [];
          expect(exams).toHaveLength(1);
          for (const exam of exams) {
            // Click one opens the exam's entry. It is a set table, or the
            // track cards whose every card opens one: click two.
            const group = yield* world.visitor.query(catalog.getGroupPage, {
              appLocale: "id",
              publicPath: exam.entryPath,
            });
            const tables =
              group === null
                ? [exam.entryPath]
                : Arr.map(group.tracks, (track) => track.publicPath);
            expect(tables).toEqual(
              paired
                ? [TRACK_PATH, "try-out/indonesia/snbt/2027/paired-id"]
                : [TRACK_PATH]
            );
            for (const table of tables) {
              expect(
                yield* world.visitor.query(catalog.getTrackPage, {
                  appLocale: "id",
                  publicPath: table,
                })
              ).not.toBeNull();
            }
            expect(
              group === null ? exam.entryPath : group.groups[0]?.entryPath
            ).toBe(paired ? GROUP_PATH : TRACK_PATH);
          }
        }
      })
  );

});
