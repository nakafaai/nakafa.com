import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { decodeProtectedRuntimeRow } from "@repo/backend/content/tryout/exchange";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
// @vitest-environment node

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import {
  APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  createTestPublication,
  makeRuntimeSource,
} from "@repo/backend/test/content/publication";
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

const fetchQueryMock = vi.hoisted(() => vi.fn());
const transportMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));
vi.mock("@/lib/content/cache", () => ({
  applyContentCache: vi.fn(),
  applyImmutableContentCache: vi.fn(),
}));
vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://runtime.example.test",
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
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
  fetchQueryMock.mockReset();
  transportMock.mockReset();
  vi.stubGlobal("fetch", transportMock);
});

describe("immutable try-out application catalog", () => {
  it.effect.each(APP_LOCALE_CODES)(
    "serves the complete signed %s hierarchy and route metadata",
    (locale) =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        fetchQueryMock.mockImplementation(context.query);
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
        const context = yield* createTestPublication(fixture.source);
        fetchQueryMock.mockImplementation(context.query);
        const selected = yield* Effect.promise(() =>
          context.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
            appLocale: "id",
          })
        );
        const request = yield* makeTryoutRuntimeRequest([selected.question]);
        const row = yield* Effect.promise(() =>
          context.query(
            internal.contentRelease.runtime.protected.internal.read,
            request
          )
        );
        const found = yield* decodeProtectedRuntimeRow(
          row,
          yield* decodeProtectedContentRuntimeRequest(request)
        ).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        );
        assert.isNotNull(found);
        const response = new Response(JSON.stringify(found), {
          headers: {
            "content-type": "application/json",
            [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
          },
        });
        Object.defineProperty(response, "url", {
          value: `https://runtime.example.test${PROTECTED_CONTENT_RUNTIME_PATH}`,
        });
        transportMock.mockResolvedValueOnce(response);
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
        const context = yield* createTestPublication(
          makeRuntimeSource().source
        );
        fetchQueryMock.mockImplementation(context.query);
        yield* Effect.promise(() =>
          expect(readTryoutHubPage("en")).rejects.toMatchObject({
            _tag: "TryoutCatalogReadError",
          })
        );
        yield* Effect.promise(() =>
          expect(readTryoutCountryPage("en", COUNTRY)).rejects.toMatchObject({
            _tag: "TryoutCatalogReadError",
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
