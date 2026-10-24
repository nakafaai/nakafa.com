import { Ref } from "@confect/core";
import type { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";

const layerMock = vi.hoisted(() => vi.fn());

import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";

// @vitest-environment node

// Node tests isolate Next navigation imports while real semantic renderers execute.
vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { decodeProtectedRuntimeRow } from "@repo/backend/content/tryout/exchange";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { makeLandingSource } from "@repo/backend/test/tryout/landing";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import type { FunctionReference } from "convex/server";
import { Effect, Layer, Option, Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import { loadTryoutQuestion } from "@/components/tryout/content/signed";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { activateTestRelease } from "@/test/active";
import { resetTestRuntimeCache } from "@/test/store";

const TEST_RELEASE_ID = "release-signed-test";

const runtimeKeysMock = vi.hoisted(() => vi.fn());
const runtimeSiteMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const sessionMock = vi.hoisted(() => vi.fn());
const queryMock = vi.hoisted(() =>
  vi.fn<
    (
      functionReference: FunctionReference<"query">,
      encodedArgs: unknown
    ) => PromiseLike<unknown>
  >()
);
const siteUrl = "https://runtime.example.test";
const endpoint = `${siteUrl}${PROTECTED_CONTENT_RUNTIME_PATH}`;
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) => {
        layerMock(...args);
        return Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: (reference, ...[args]) => {
                assert(args !== undefined);
                return Ref.runWithCodec(
                  reference,
                  args,
                  queryMock,
                  (cause) => new HttpClient.HttpClientError({ cause })
                );
              },
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args)));
      },
    },
  };
});
vi.mock(
  "@vercel/functions",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.test/en/try-out"),
}));
vi.mock("@/lib/auth/session.server", () => ({
  readSessionMemo: sessionMock,
}));
vi.mock("@repo/site/keys", () => ({
  contentRuntimeKeys: runtimeKeysMock,
}));
vi.mock("@/env.public", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@/env", () => ({
  env: {
    get VITE_CONVEX_SITE_URL() {
      return runtimeSiteMock();
    },
  },
}));
vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return {
    contentKeyResolver: TEST_KEY_RESOLVER,
  };
});

/** Selects a public question through the real active Convex catalog query. */
const readFixture = Effect.fn("TryoutExecutionTest.fixture")(function* (
  compiledCode?: string
) {
  const source = yield* makeTryoutRuntimeSource(
    compiledCode,
    makeLandingSource()
  );
  const runtime = yield* createTestPublication(source.source);
  const featured = yield* runtime.query(
    refs.public.tryouts.queries.catalog.getFeaturedQuestion,
    {
      appLocale: "en",
    }
  );
  return {
    runtime,
    question: featured.question,
  };
});

beforeEach(() => {
  resetTestRuntimeCache();
  activateTestRelease(TEST_RELEASE_ID);
  vi.setSystemTime(TRYOUT_TEST_NOW);
  fetchMock.mockReset();
  queryMock.mockReset();
  sessionMock
    .mockReset()
    .mockReturnValue(
      Effect.succeed(
        Effect.succeed({ convexToken: Option.some("technical-session-token") })
      )
    );
  runtimeSiteMock.mockReset().mockReturnValue(siteUrl);
  runtimeKeysMock.mockReset().mockImplementation(() => {
    throw new ContentRuntimeConfigurationError({
      key: "CONTENT_RUNTIME_TOKEN",
    });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("featured try-out question", () => {
  it.effect(
    "verifies and executes the same signed exchange through live HTTP",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        const request = yield* makeTryoutRuntimeRequest([fixture.question]);
        const row = yield* fixture.runtime.query(
          refs.internal.contentRelease.runtime.tryout.internal.read,
          request
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
        const body = yield* Schema.encodeEffect(JsonTextSchema)(found);
        const response = new Response(body, {
          headers: {
            "content-type": "application/json",
            [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
          },
          status: 200,
        });
        Object.defineProperty(response, "url", {
          value: endpoint,
        });
        fetchMock.mockResolvedValueOnce(response);
        runtimeKeysMock.mockReturnValue({
          CONTENT_RUNTIME_TOKEN: "technical-test-token",
        });
        const rendered = yield* loadTryoutQuestion(fixture.question);
        expect(renderToStaticMarkup(rendered.content)).toBe(
          "Technical question"
        );
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(runtimeKeysMock).toHaveBeenCalledOnce();
        // The found answer is kept for the release, so the next home view reads no runtime.
        const again = yield* loadTryoutQuestion(fixture.question);
        expect(renderToStaticMarkup(again.content)).toBe("Technical question");
        expect(fetchMock).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "keeps no missing featured answer, so every read asks the runtime again",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        runtimeKeysMock.mockReturnValue({
          CONTENT_RUNTIME_TOKEN: "technical-test-token",
        });
        fetchMock.mockImplementation(() => {
          const response = new Response(encodeJsonText({ kind: "missing" }), {
            headers: {
              "content-type": "application/json",
              [CONTENT_RUNTIME_RESPONSE_HEADER]:
                CONTENT_RUNTIME_RESPONSE_MARKER,
            },
            status: 404,
          });
          Object.defineProperty(response, "url", { value: endpoint });
          return Promise.resolve(response);
        });
        expect(
          yield* loadTryoutQuestion(fixture.question).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
        });
        expect(
          yield* loadTryoutQuestion(fixture.question).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
      })
  );
});
