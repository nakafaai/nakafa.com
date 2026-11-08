// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readGroupRedirect } from "@/lib/routing/public/tryout/group";
import { type RouteIdentity, serveTryoutCatalog } from "@/test/catalog";

const mocks = vi.hoisted(() => ({
  exam: vi.fn(),
  group: vi.fn(),
  path: vi.fn(),
  section: vi.fn(),
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: mocks.path,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: mocks.exam,
  readPublishedTryoutGroupPage: mocks.group,
  readPublishedTryoutSectionPage: mocks.section,
}));

/** One route that the signed catalog serves in Indonesian. */
const live = (path: string): RouteIdentity => ({ id: path });

const TKA = "try-out/indonesia/tka";
const TKA_GRADE = `${TKA}/sma-ma-smk`;
const TKA_TRACK = `${TKA_GRADE}/matematika-wajib`;
const SNBT = "try-out/indonesia/snbt";
const SNBT_YEAR = `${SNBT}/2027`;
const SNBT_TRACK = `${SNBT_YEAR}/utbk`;

/** The signed catalog of both exams: TKA by grade, and SNBT's one year with its one track. */
const CATALOG = {
  exams: [
    {
      appLocale: "id",
      groupAxis: "grade",
      groups: [{ groupKey: "senior-high-school", publicPath: TKA_GRADE }],
      publicPath: TKA,
    },
    {
      appLocale: "id",
      groupAxis: "year",
      groups: [{ groupKey: "2027", publicPath: SNBT_YEAR }],
      publicPath: SNBT,
    },
  ],
  groups: [
    {
      appLocale: "id",
      publicPath: TKA_GRADE,
      tracks: [
        { publicPath: TKA_TRACK, trackKey: "compulsory-mathematics" },
        {
          publicPath: `${TKA_GRADE}/bahasa-inggris`,
          trackKey: "english-language",
        },
      ],
    },
    {
      appLocale: "id",
      publicPath: SNBT_YEAR,
      tracks: [{ publicPath: SNBT_TRACK, trackKey: "2027" }],
    },
  ],
  routes: [
    live(TKA),
    live(TKA_GRADE),
    live(TKA_TRACK),
    live(`${TKA_TRACK}/set-1`),
    live(SNBT),
    live(SNBT_YEAR),
    live(SNBT_TRACK),
    live(`${SNBT_TRACK}/set-1`),
    live(`${SNBT_TRACK}/set-1/literasi-dalam-bahasa-inggris`),
  ],
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  serveTryoutCatalog(mocks, CATALOG);
});

describe("try-out URLs from before the groups", () => {
  it.effect.each([
    "/id",
    "/fr/try-out/indonesia/tka",
    "/id/articles/politik",
    "/id/try-out/indonesia",
  ])("leaves %s, which names no exam, alone", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readGroupRedirect(pathname)).toBeNull();
      expect(mocks.exam).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "sends an exam's own address to its first group, for now",
    () =>
      Effect.gen(function* () {
        expect(yield* readGroupRedirect("/id/try-out/indonesia/tka")).toEqual({
          destination: `/id/${TKA_GRADE}`,
          status: 307,
        });
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/ujian-lain")
        ).toBeNull();
      })
  );

  it.effect("leaves an exam without a group on its 404", () =>
    Effect.gen(function* () {
      serveTryoutCatalog(mocks, {
        exams: [
          { appLocale: "id", groupAxis: "grade", groups: [], publicPath: TKA },
        ],
      });

      expect(yield* readGroupRedirect("/id/try-out/indonesia/tka")).toBeNull();
    })
  );

  it.effect.each([
    `/id/${TKA_TRACK}`,
    `/id/${TKA_TRACK}/set-1`,
    `/id/${SNBT_TRACK}/set-1`,
  ])("leaves the live page %s alone", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readGroupRedirect(pathname)).toBeNull();
    })
  );

  it.effect("leaves a path deeper than any page alone", () =>
    Effect.gen(function* () {
      expect(
        yield* readGroupRedirect(`/id/${SNBT}/2027/utbk/set-1/a/b`)
      ).toBeNull();
      expect(mocks.path).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "moves a TKA track and its sets under their grade, for good",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/tka/matematika-wajib")
        ).toEqual({ destination: `/id/${TKA_TRACK}`, status: 308 });
        expect(
          yield* readGroupRedirect(
            "/id/try-out/indonesia/tka/matematika-wajib/set-1"
          )
        ).toEqual({ destination: `/id/${TKA_TRACK}/set-1`, status: 308 });
      })
  );

  it.effect(
    "leaves an old track path on its 404 when no track or no live page answers it",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/tka/fisika")
        ).toBeNull();
        expect(
          yield* readGroupRedirect(
            "/id/try-out/indonesia/tka/bahasa-inggris/set-1"
          )
        ).toBeNull();
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/ujian-lain/fisika")
        ).toBeNull();
      })
  );

  it.effect("skips a group of the exam that has no page", () =>
    Effect.gen(function* () {
      serveTryoutCatalog(mocks, {
        ...CATALOG,
        exams: [
          {
            appLocale: "id",
            groupAxis: "grade",
            groups: [
              { groupKey: "junior-high-school", publicPath: `${TKA}/smp-mts` },
              { groupKey: "senior-high-school", publicPath: TKA_GRADE },
            ],
            publicPath: TKA,
          },
        ],
      });

      expect(
        yield* readGroupRedirect("/id/try-out/indonesia/tka/matematika-wajib")
      ).toEqual({ destination: `/id/${TKA_TRACK}`, status: 308 });
    })
  );

  it.effect(
    "moves an SNBT set of 2027 into the year's UTBK, its section renamed when it was, for good",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/snbt/2027/set-1")
        ).toEqual({ destination: `/id/${SNBT_TRACK}/set-1`, status: 308 });
        expect(
          yield* readGroupRedirect(
            "/id/try-out/indonesia/snbt/2027/set-1/bahasa-inggris"
          )
        ).toEqual({
          destination: `/id/${SNBT_TRACK}/set-1/literasi-dalam-bahasa-inggris`,
          status: 308,
        });
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/snbt/2027/set-9")
        ).toBeNull();
      })
  );

  it.effect(
    "leaves a set of a group with more than one track, or none, on its 404",
    () =>
      Effect.gen(function* () {
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/tka/sma-ma-smk/set-1")
        ).toBeNull();
        serveTryoutCatalog(mocks, { ...CATALOG, groups: [] });
        expect(
          yield* readGroupRedirect("/id/try-out/indonesia/snbt/2027/set-1")
        ).toBeNull();
      })
  );
});
