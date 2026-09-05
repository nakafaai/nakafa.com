// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { makeLandingSource } from "@repo/backend/test/tryout/landing";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import {
  readFeaturedTryout,
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
  readTryoutMetadata,
  readTryoutSectionAttemptPage,
  readTryoutSectionPage,
  readTryoutSetAttemptPage,
  readTryoutSetPage,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/server";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import { createTestSnapshotFetch } from "@/test/runtime-query";

const fetchRuntimeQueryMock = vi.hoisted(() => vi.fn());
const fetchQueryMock = vi.hoisted(() => vi.fn());
const loadSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", () => ({
  fetchRuntimeQuery: fetchRuntimeQueryMock,
}));
vi.mock("@/lib/content/runtime/snapshot", () => ({
  loadContentSnapshot: loadSnapshotMock,
}));
vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: vi.fn(),
  applyPublishedContentBatchCache: vi.fn(),
}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_SITE_URL: "https://runtime.example.test" },
}));
vi.mock("@repo/next-config/keys", () => ({
  contentRuntimeKeys: () => ({ CONTENT_RUNTIME_TOKEN: "technical-test-token" }),
}));
vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return { contentKeyResolver: TEST_KEY_RESOLVER };
});
vi.mock("@/lib/content/renderer/manifest", async () => {
  const { TEST_PROOF_RENDERER } = await import(
    "@repo/backend/test/content/proof"
  );
  const { Effect } = await import("effect");
  return { rendererManifest: Effect.succeed(TEST_PROOF_RENDERER) };
});

const COUNTRY = "try-out/indonesia";
const EXAM = `${COUNTRY}/tka`;
const TRACK = `${EXAM}/matematika`;
const SET = `${TRACK}/set-1`;
const SECTION = `${SET}/matematika`;

beforeEach(() => {
  fetchRuntimeQueryMock.mockReset();
  fetchQueryMock.mockReset();
  loadSnapshotMock.mockReset();
});

describe("immutable try-out application catalog", () => {
  it.effect.each(APP_LOCALE_CODES)(
    "serves the complete signed %s hierarchy and route metadata",
    (locale) =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestSnapshotContext(fixture.source);
        fetchRuntimeQueryMock.mockImplementation(
          createTestSnapshotFetch(context)
        );
        const pages = yield* Effect.promise(() =>
          Promise.all([
            readTryoutHubPage(locale),
            readTryoutCountryPage(locale, COUNTRY),
            readTryoutExamPage(locale, EXAM),
            readTryoutTrackPage(locale, TRACK),
            readTryoutSetPage(locale, SET),
            readTryoutSectionPage(locale, SECTION),
          ])
        );
        expect(pages[0]).toMatchObject({
          countries: [{ title: "Indonesia" }],
          sourceRevision: "a".repeat(40),
        });
        expect(pages[1]).toMatchObject({
          country: { publicPath: COUNTRY },
          exams: [{ title: "TKA" }],
        });
        expect(pages[2]).toMatchObject({
          exam: { publicPath: EXAM },
          tracks: [{ publicPath: TRACK }],
        });
        expect(pages[3]).toMatchObject({ track: { publicPath: TRACK } });
        expect(pages[4]).toMatchObject({
          set: { publicPath: SET },
          sections: [{ publicPath: SECTION }],
        });
        expect(pages[5]).toMatchObject({
          section: { publicPath: SECTION },
          set: { publicPath: SET },
        });
        const metadata = yield* Effect.promise(() =>
          readTryoutMetadata({
            appLocale: AppLocaleSchema.make(locale),
            kind: "track",
            publicPath: TRACK,
          })
        );
        expect(metadata.route).toMatchObject({
          publicPath: TRACK,
          title: { en: "Mathematics", id: "Matematika", de: "Mathematik" }[
            locale
          ],
          alternates: APP_LOCALE_CODES.map((appLocale) => ({
            appLocale,
            publicPath: TRACK,
          })),
        });
        expect(
          yield* Effect.promise(() =>
            readTryoutCountryPage(locale, "try-out/missing")
          )
        ).toBeNull();
      })
  );

  it.effect(
    "authenticates and renders the real featured question artifact",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource(
          undefined,
          makeLandingSource()
        );
        const context = yield* createTestSnapshotContext(fixture.source);
        fetchRuntimeQueryMock.mockImplementation(
          createTestSnapshotFetch(context)
        );
        loadSnapshotMock.mockResolvedValue(context);
        const featured = yield* Effect.promise(() => readFeaturedTryout("id"));
        expect(renderToStaticMarkup(featured.question)).toBe(
          "Technical question"
        );
        expect(featured.response).toMatchObject({
          kind: "single-choice",
          options: [{ optionKey: "option-1" }, { optionKey: "option-2" }],
        });
      })
  );

  it.effect(
    "preserves unavailable publication failures at Promise page boundaries",
    () =>
      Effect.gen(function* () {
        const context = yield* createTestSnapshotContext(
          makeRuntimeSource().source
        );
        fetchRuntimeQueryMock.mockImplementation(
          createTestSnapshotFetch(context)
        );
        yield* Effect.promise(() =>
          expect(readTryoutHubPage("en")).rejects.toMatchObject({
            _tag: "TryoutCatalogReadError",
            cause: {
              _tag: "ReleaseError",
              code: "CONTENT_RELEASE_MISSING",
            },
          })
        );
        yield* Effect.promise(() =>
          expect(readTryoutCountryPage("en", COUNTRY)).rejects.toMatchObject({
            _tag: "TryoutCatalogReadError",
            cause: {
              _tag: "ReleaseError",
              code: "CONTENT_RELEASE_MISSING",
            },
          })
        );
      })
  );

  it.effect(
    "keeps absent attempt overlays and transport failures distinct",
    () =>
      Effect.gen(function* () {
        const request = {
          kind: "retained",
          attemptId: "missing-attempt",
          locale: "en",
          publicPath: SET,
        } as const;
        fetchQueryMock.mockResolvedValue(null);
        expect(
          yield* readTryoutSetAttemptPage("technical-token", request)
        ).toBeNull();
        expect(
          yield* readTryoutSectionAttemptPage("technical-token", {
            ...request,
            publicPath: SECTION,
          })
        ).toBeNull();
        fetchQueryMock.mockRejectedValue(new Error("Transport unavailable"));
        expect(
          yield* readTryoutSetAttemptPage("technical-token", request).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "TryoutCatalogReadError",
          cause: { message: "Transport unavailable" },
        });
        expect(
          yield* readTryoutSectionAttemptPage("technical-token", {
            ...request,
            publicPath: SECTION,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "TryoutCatalogReadError",
          cause: { message: "Transport unavailable" },
        });
      })
  );
});
