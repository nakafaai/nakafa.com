import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import {
  activateTryoutStartSource,
  makeTryoutStartHierarchy,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const countryPath = `try-out/${TRYOUT_START_COUNTRY}`;
const examPath = `${countryPath}/${TRYOUT_START_EXAM}`;
const trackPath = `${examPath}/${TRYOUT_START_TRACK}`;
const setPath = `${trackPath}/${TRYOUT_START_SET}`;
const sectionPath = `${setPath}/${TRYOUT_START_SECTION}`;
const locales: readonly ActiveAppLocaleCode[] = ["en", "id"];

describe("tryouts/queries/catalog", () => {
  it("serves the complete signed hierarchy without filesystem catalog rows", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"));

    const hub = await t.query(api.tryouts.queries.catalog.getHubPage, {
      appLocale: "id",
    });
    const country = await t.query(api.tryouts.queries.catalog.getCountryPage, {
      appLocale: "id",
      publicPath: countryPath,
    });
    const exam = await t.query(api.tryouts.queries.catalog.getExamPage, {
      appLocale: "id",
      publicPath: examPath,
    });
    const track = await t.query(api.tryouts.queries.catalog.getTrackPage, {
      appLocale: "id",
      publicPath: trackPath,
    });
    const set = await t.query(api.tryouts.queries.catalog.getSetPage, {
      appLocale: "id",
      publicPath: setPath,
    });
    const section = await t.query(api.tryouts.queries.catalog.getSectionPage, {
      appLocale: "id",
      publicPath: sectionPath,
    });
    const localizedPath = await t.query(
      api.tryouts.queries.catalog.getLocalizedPath,
      {
        currentAppLocale: "id",
        publicPath: sectionPath,
        targetAppLocale: "en",
      }
    );

    expect(hub).toMatchObject({
      countries: [
        expect.objectContaining({
          countryKey: TRYOUT_START_COUNTRY,
          examCount: 1,
        }),
      ],
      sourceRevision: "a".repeat(40),
    });
    expect(country).toMatchObject({
      exams: [expect.objectContaining({ examKey: TRYOUT_START_EXAM })],
      sourceRevision: "a".repeat(40),
    });
    expect(exam?.tracks).toEqual([
      expect.objectContaining({ trackKey: TRYOUT_START_TRACK }),
    ]);
    expect(track?.track).toMatchObject({ trackKey: TRYOUT_START_TRACK });
    expect(set).toMatchObject({
      entrySection: { sectionKey: TRYOUT_START_SECTION },
      set: { setKey: TRYOUT_START_SET },
      sections: [{ sectionKey: TRYOUT_START_SECTION }],
    });
    expect(section).toMatchObject({
      section: { sectionKey: TRYOUT_START_SECTION },
      set: { setKey: TRYOUT_START_SET },
    });
    expect(localizedPath).toBe(sectionPath);
  });

  it("fails closed when a signed set loses its internal entry section", async () => {
    const t = convexTest(schema, convexModules);
    const catalog = locales.flatMap((locale) =>
      makeTryoutStartHierarchy(locale, "internal-entry").map((row) => {
        if (row.kind !== "set") {
          return row;
        }
        return { ...row, internalEntrySectionKey: "missing" };
      })
    );

    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog,
        placements: locales.map(makeTryoutStartPlacement),
      })
    );

    await expect(
      t.query(api.tryouts.queries.catalog.getSetPage, {
        appLocale: "id",
        publicPath: setPath,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("returns null for paths absent from the active signed hierarchy", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateTryoutStartSource(ctx, "visible"));

    const [track, set, section] = await Promise.all([
      t.query(api.tryouts.queries.catalog.getTrackPage, {
        appLocale: "id",
        publicPath: `${examPath}/missing`,
      }),
      t.query(api.tryouts.queries.catalog.getSetPage, {
        appLocale: "id",
        publicPath: `${trackPath}/missing`,
      }),
      t.query(api.tryouts.queries.catalog.getSectionPage, {
        appLocale: "id",
        publicPath: `${setPath}/missing`,
      }),
    ]);

    expect({ section, set, track }).toEqual({
      section: null,
      set: null,
      track: null,
    });
  });

  it("serves an authored internal entry without a public section route", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: locales.flatMap((locale) =>
          makeTryoutStartHierarchy(locale, "internal-entry")
        ),
        placements: locales.map(makeTryoutStartPlacement),
      })
    );

    const page = await t.query(api.tryouts.queries.catalog.getSetPage, {
      appLocale: "id",
      publicPath: setPath,
    });

    expect(page?.sections).toEqual([]);
    expect(page?.entrySection).toMatchObject({
      sectionKey: TRYOUT_START_SECTION,
      visibility: "internal-entry",
    });
    expect(page?.entrySection?.publicPath).toBeUndefined();
  });
});
