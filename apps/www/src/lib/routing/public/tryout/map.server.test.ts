// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";
import {
  TRYOUT_MAP_PATH,
  TryoutMapJson,
} from "@/lib/routing/public/tryout/map";

const release = vi.hoisted(() => ({ hasStaticRelease: true }));

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which the deployed Worker binds and a prerender does not. */
  env: {
    get ASSETS() {
      return release.hasStaticRelease ? assets : undefined;
    },
  },
}));

const SNBT = "try-out/indonesia/snbt";
const YEAR = `${SNBT}/2027`;
const TRACK = `${YEAR}/utbk`;
const SET = `${TRACK}/set-1`;
const SECTION = `${SET}/penalaran-umum`;

/** A release's map: Indonesian with SNBT's one year, track, set and section, and English, whose SNBT exam the catalog answers with its country. */
const MAP: typeof TryoutMapJson.Type = {
  id: {
    countries: [{ countryCode: "ID", publicPath: "try-out/indonesia" }],
    exams: {
      [SNBT]: {
        exam: { groupAxis: "year" },
        groups: [{ entryPath: TRACK, groupKey: "2027", publicPath: YEAR }],
      },
    },
    groups: { [YEAR]: [TRACK] },
    localized: { [SET]: `${TRACK}/set-1-id` },
    paths: [SNBT, YEAR, TRACK, SET, SECTION],
    sections: [SECTION],
  },
  en: {
    countries: [{ countryCode: "ID", publicPath: "try-out/indonesia" }],
    exams: {},
    groups: {},
    localized: { [SNBT]: "try-out/indonesia" },
    paths: [SNBT, "try-out/indonesia"],
    sections: [],
  },
};

/** Serves the map's asset with the given body, or the given status. */
function serveMap(body: string, status = 200) {
  assets.fetch.mockImplementation(async (request) =>
    new URL(request.url).pathname === TRYOUT_MAP_PATH
      ? new Response(body, { status })
      : new Response("missing", { status: 404 })
  );
}

/** A fresh copy of the reader, whose isolate has read no map yet. */
function freshReader() {
  vi.resetModules();
  return import("@/lib/routing/public/tryout/map.server");
}

beforeEach(() => {
  release.hasStaticRelease = true;
  assets.fetch.mockReset();
  serveMap(Schema.encodeSync(TryoutMapJson)(MAP));
});

describe("the try-out map in the Worker", () => {
  it.effect("answers the redirects' reads from the map the build wrote", () =>
    Effect.gen(function* () {
      const map = yield* Effect.promise(freshReader);

      expect(yield* map.readMappedHubPage({ appLocale: "id" })).toEqual({
        countries: MAP.id?.countries,
      });
      expect(
        yield* map.readMappedExamPage({ appLocale: "id", publicPath: SNBT })
      ).toEqual(MAP.id?.exams[SNBT]);
      expect(
        yield* map.readMappedGroupPage({ appLocale: "id", publicPath: YEAR })
      ).toEqual({ tracks: [{ publicPath: TRACK }] });
      expect(
        yield* map.readMappedSectionPage({
          appLocale: "id",
          publicPath: SECTION,
        })
      ).toEqual({ publicPath: SECTION });
      expect(yield* map.readActiveTryoutPath("id", SET)).toBe(SET);
      expect(
        yield* map.readMappedLocalizedPath({
          currentAppLocale: "en",
          publicPath: SET,
          targetAppLocale: "id",
        })
      ).toBe(`${TRACK}/set-1-id`);
    })
  );

  it.effect(
    "answers a canonical SNBT path from English as the catalog answered it, an exam with the page above it",
    () =>
      Effect.gen(function* () {
        const map = yield* Effect.promise(freshReader);

        expect(
          yield* map.readMappedLocalizedPath({
            currentAppLocale: "en",
            publicPath: SNBT,
            targetAppLocale: "en",
          })
        ).toBe("try-out/indonesia");
        expect(yield* map.readActiveTryoutPath("en", "try-out/indonesia")).toBe(
          "try-out/indonesia"
        );
      })
  );

  it.effect("reads the asset once for every read of one isolate", () =>
    Effect.gen(function* () {
      const map = yield* Effect.promise(freshReader);

      yield* map.readActiveTryoutPath("id", SET);
      yield* map.readMappedGroupPage({ appLocale: "id", publicPath: YEAR });

      expect(assets.fetch).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "answers a path, an exam, a group, a section or a locale the map does not hold as no page",
    () =>
      Effect.gen(function* () {
        const map = yield* Effect.promise(freshReader);

        expect(yield* map.readActiveTryoutPath("id", `${SNBT}/set-1`)).toBe(
          null
        );
        expect(yield* map.readActiveTryoutPath("de", SET)).toBe(null);
        expect(
          yield* map.readMappedExamPage({ appLocale: "id", publicPath: YEAR })
        ).toBe(null);
        expect(
          yield* map.readMappedGroupPage({ appLocale: "id", publicPath: SNBT })
        ).toBe(null);
        expect(
          yield* map.readMappedSectionPage({ appLocale: "id", publicPath: SET })
        ).toBe(null);
        expect(
          yield* map.readMappedLocalizedPath({
            currentAppLocale: "en",
            publicPath: TRACK,
            targetAppLocale: "id",
          })
        ).toBe(null);
        expect(yield* map.readMappedHubPage({ appLocale: "de" })).toEqual({
          countries: [],
        });
      })
  );

  it.effect(
    "fails as a defect of the build on a malformed or missing map",
    () =>
      Effect.gen(function* () {
        serveMap("{not a map");
        const malformed = yield* Effect.promise(freshReader);
        const unread = yield* Effect.exit(
          malformed.readActiveTryoutPath("id", SET)
        );
        expect(Exit.isFailure(unread)).toBe(true);
        expect(Exit.findErrorOption(unread)).toMatchObject({
          value: { _tag: "TryoutMapUnavailable" },
        });

        serveMap("missing", 404);
        const missing = yield* Effect.promise(freshReader);
        const absent = yield* Effect.exit(
          missing.readMappedExamPage({ appLocale: "id", publicPath: SNBT })
        );
        expect(Exit.findErrorOption(absent)).toMatchObject({
          value: { _tag: "TryoutMapUnavailable", status: 404 },
        });
      })
  );

  it.effect(
    "redirects nothing in a prerender or a development server, which bind no assets",
    () =>
      Effect.gen(function* () {
        release.hasStaticRelease = false;
        const map = yield* Effect.promise(freshReader);

        expect(yield* map.readActiveTryoutPath("id", SET)).toBe(null);
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );
});
