// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { Array as Arr, Effect } from "effect";
import { readCurriculumTrail } from "@/lib/curriculum/trail";
import {
  testProgramClass,
  testProgramRoot,
  testProgramSubject,
  testPublishedProgram,
} from "@/test/published/program";

const route = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/program/route", () => ({
  readPublishedProgramRoute: route,
}));

/** A second curriculum of the catalog, whose program names no home country. */
const cambridge = {
  ...testProgramRoot,
  nodeKey: "cambridge",
  publicPath: PublicPathSchema.make("curriculum/cambridge"),
  title: "Cambridge",
};
const physics = {
  ...testProgramSubject,
  nodeKey: "physics",
  publicPath: PublicPathSchema.make("curriculum/merdeka/class-11/physics"),
  title: "Physics",
};
const { homeCountry: _home, ...worldwide } = testPublishedProgram.provider;
const catalog = {
  entries: [
    {
      program: testPublishedProgram,
      route: testProgramRoot,
      translation: testPublishedProgram.translations[0],
    },
    {
      program: { ...testPublishedProgram, provider: worldwide },
      route: cambridge,
      translation: testPublishedProgram.translations[0],
    },
  ],
  sourceRevision: null,
};

/** One resolved page of the curriculum, with its ancestors from the curriculum down. */
function pageOf(
  page: typeof testProgramSubject,
  ancestors: (typeof testProgramSubject)[]
) {
  return {
    alternates: [],
    ancestors,
    childRoutes: [],
    locale: "en" as const,
    materialCards: [],
    program: testPublishedProgram,
    route: page,
    sourcePath: page.sourcePath,
    sourceRevision: null,
  };
}

describe("readCurriculumTrail", () => {
  it.effect(
    "offers each crumb its siblings: the catalog's curricula, then each parent's children",
    () =>
      Effect.gen(function* () {
        route.mockReset().mockImplementation((_locale, publicPath: string) =>
          Effect.succeed({
            children:
              publicPath === testProgramRoot.publicPath
                ? [testProgramClass]
                : [testProgramSubject, physics],
          })
        );

        const trail = yield* readCurriculumTrail(
          pageOf(testProgramSubject, [testProgramRoot, testProgramClass]),
          catalog
        );

        expect(trail).toMatchObject([
          {
            level: "track",
            options: [
              { countryCode: "ID", current: true, title: "Kurikulum Merdeka" },
              { current: false, title: "Cambridge" },
            ],
          },
          { level: "class", options: [{ current: true, title: "Class 11" }] },
          {
            level: "subject",
            options: [
              { current: true, title: "Mathematics" },
              { current: false, title: "Physics" },
            ],
          },
        ]);
        expect(trail[0]?.options[1]).not.toHaveProperty("countryCode");
      })
  );

  it.effect("draws no crumb for a page of the path that is no view", () =>
    Effect.gen(function* () {
      route
        .mockReset()
        .mockReturnValue(Effect.succeed({ children: [testProgramSubject] }));
      const unit = { ...testProgramClass, level: "unit" as const };

      const trail = yield* readCurriculumTrail(
        pageOf(testProgramSubject, [testProgramRoot, unit]),
        catalog
      );

      expect(Arr.map(trail, (level) => level.level)).toEqual([
        "track",
        "subject",
      ]);
    })
  );

  it.effect("reads no route for a curriculum's own page", () =>
    Effect.gen(function* () {
      route.mockReset();

      const trail = yield* readCurriculumTrail(pageOf(cambridge, []), catalog);

      expect(trail).toMatchObject([
        {
          level: "track",
          options: [{ current: false }, { current: true, title: "Cambridge" }],
        },
      ]);
      expect(route).not.toHaveBeenCalled();
    })
  );
});
