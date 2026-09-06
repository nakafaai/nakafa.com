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
import { compile } from "@mdx-js/mdx";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { decodeProtectedRuntimeRow } from "@repo/backend/content/tryout/exchange";
import { api, internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import type { TryoutBodyBatch } from "@repo/backend/convex/tryouts/runtime/body";
import type { TryoutHistoryRequest } from "@repo/backend/convex/tryouts/runtime/history/spec";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { insertHistoryAttempt } from "@repo/backend/test/tryout/history";
import { makeLandingSource } from "@repo/backend/test/tryout/landing";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import type { SignedContentAccess } from "@/components/tryout/content/model";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import {
  loadSignedTryoutContent,
  loadTryoutQuestion,
} from "@/components/tryout/content/signed";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";

const runtimeKeysMock = vi.hoisted(() => vi.fn());
const runtimeSiteMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const tokenMock = vi.hoisted(() => vi.fn());
const queryMock = vi.hoisted(() =>
  vi.fn<
    (
      reference: unknown,
      request: TryoutHistoryRequest,
      options: { token: string }
    ) => Promise<TryoutBodyBatch | null>
  >()
);
const siteUrl = "https://runtime.example.test";
const endpoint = `${siteUrl}${PROTECTED_CONTENT_RUNTIME_PATH}`;
const attemptQuery = makeFunctionReference<
  "query",
  TryoutHistoryRequest,
  TryoutBodyBatch | null
>("tryouts/queries/content:getBatch");

vi.mock("convex/nextjs", () => ({ fetchQuery: queryMock }));
vi.mock("@/lib/auth/server", () => ({ getToken: tokenMock }));
vi.mock("@/lib/content/cache", () => ({
  applyImmutableContentCache: cacheMock,
}));
vi.mock("@repo/next-config/keys", () => ({
  contentRuntimeKeys: runtimeKeysMock,
}));
vi.mock("@/env", () => ({
  env: {
    get NEXT_PUBLIC_CONVEX_SITE_URL() {
      return runtimeSiteMock();
    },
  },
}));
vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return { contentKeyResolver: TEST_KEY_RESOLVER };
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
  const featured = yield* Effect.promise(() =>
    runtime.query(api.tryouts.queries.catalog.getFeaturedQuestion, {
      appLocale: "en",
    })
  );
  return { runtime, question: featured.question };
});

/** Routes the app transport into real session and retained membership queries. */
const readOwnedFixture = Effect.fn("TryoutExecutionTest.ownedFixture")(
  function* (options?: Parameters<typeof insertHistoryAttempt>[2]) {
    const t = createConvexTestWithBetterAuth();
    const seed = yield* Effect.promise(() =>
      t.mutation((ctx) => insertHistoryAttempt(ctx, true, options))
    );
    const owned = t.withIdentity({
      subject: seed.identity.authUserId,
      sessionId: seed.identity.sessionId,
    });
    const access: SignedContentAccess = {
      answers: seed.request.selectors.filter(
        (selector) => selector.delivery === "entitled"
      ),
      kind: "signed",
      questions: seed.request.selectors.filter(
        (selector) => selector.delivery === "authenticated"
      ),
    };
    queryMock.mockImplementation((_reference, request, options) => {
      expect(options.token).toBe("technical-session-token");
      return owned.query(attemptQuery, request);
    });
    const question = yield* Effect.fromNullishOr(access.questions[0]);
    const answer = yield* Effect.fromNullishOr(access.answers[0]);
    return {
      access,
      answer,
      attemptId: seed.request.attemptId,
      owned,
      question,
      seed,
      t,
    };
  }
);

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
  cacheMock.mockReset();
  fetchMock.mockReset();
  queryMock.mockReset();
  tokenMock.mockReset().mockResolvedValue("technical-session-token");
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

describe("signed try-out execution", () => {
  it.effect(
    "renders complete original question and answer bodies after release compaction",
    () =>
      Effect.gen(function* () {
        const rawMdx =
          "Question opening.\n\nAll original conditions.\n\nFinal question paragraph.";
        const answerMdx =
          "Answer opening.\n\nEvery original explanation step.\n\nFinal answer paragraph.";
        const [questionCode, answerCode] = yield* Effect.promise(() =>
          Promise.all(
            [rawMdx, answerMdx].map((body) =>
              compile(body, { outputFormat: "function-body" })
            )
          )
        );
        const fixture = yield* readOwnedFixture({
          answerCompiledCode: String(answerCode),
          answerRawMdx: answerMdx,
          compiledCode: String(questionCode),
          rawMdx,
        });
        const rendered = yield* loadSignedTryoutContent(
          fixture.attemptId,
          fixture.access
        );

        expect(rendered.questions).toHaveLength(1);
        expect(rendered.answers).toHaveLength(1);
        const question = yield* Effect.fromNullishOr(rendered.questions[0]);
        const answer = yield* Effect.fromNullishOr(rendered.answers[0]);
        const questionMarkup = renderToStaticMarkup(question.content);
        const answerMarkup = renderToStaticMarkup(answer.answer);
        for (const paragraph of rawMdx.split("\n\n")) {
          expect(questionMarkup).toContain(paragraph);
        }
        for (const paragraph of answerMdx.split("\n\n")) {
          expect(answerMarkup).toContain(paragraph);
        }
        expect(question).toMatchObject({
          contentHash: fixture.question.contentHash,
          sourcePath: fixture.question.sourcePath,
          sourceRevision: fixture.question.sourceRevision,
        });
        expect(answer).toMatchObject({
          contentHash: fixture.answer.contentHash,
          sourcePath: fixture.answer.sourcePath,
          sourceRevision: fixture.answer.sourceRevision,
        });
        expect(queryMock).toHaveBeenCalledOnce();
        expect(runtimeKeysMock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(cacheMock).toHaveBeenCalledWith([
          fixture.question.artifactHash,
          fixture.answer.artifactHash,
        ]);
      })
  );

  it.effect(
    "verifies and executes the same signed exchange through live HTTP",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        const request = yield* makeTryoutRuntimeRequest([fixture.question]);
        const row = yield* Effect.promise(() =>
          fixture.runtime.query(
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
          status: 200,
        });
        Object.defineProperty(response, "url", { value: endpoint });
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
        expect(cacheMock).toHaveBeenCalledWith([fixture.question.artifactHash]);
      })
  );

  it.effect(
    "rejects a missing ordered item at the real exchange boundary before executing MDX",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readOwnedFixture({
          compiledCode:
            "throw new TypeError('must not execute an incomplete exchange');",
        });
        const row = yield* Effect.promise(() =>
          fixture.owned.query(attemptQuery, fixture.seed.request)
        );
        expect(row).not.toBeNull();
        const found = yield* Effect.fromNullishOr(row);
        queryMock.mockResolvedValue({
          ...found,
          items: found.items.slice(0, 1),
        });

        expect(
          yield* loadSignedTryoutContent(
            fixture.attemptId,
            fixture.access
          ).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: {
            _tag: "ContentRuntimeVerificationError",
            cause: {
              _tag: "ContentRuntimeMismatchError",
              reason: "selectorCount",
            },
          },
        });
        expect(queryMock).toHaveBeenCalledOnce();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "rejects an empty exported access before transport or caching",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readOwnedFixture();
        expect(
          yield* loadSignedTryoutContent(fixture.attemptId, {
            kind: "signed",
            questions: [],
            answers: [],
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: "Protected content batch is empty.",
        });
        expect(queryMock).not.toHaveBeenCalled();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "preserves a missing live credential as a typed configuration cause",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        expect(
          yield* loadTryoutQuestion(fixture.question).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: {
            _tag: "ContentRuntimeConfigurationError",
            key: "CONTENT_RUNTIME_TOKEN",
          },
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "preserves authenticated module failures and never caches incomplete rendering",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readOwnedFixture();
        expect(
          yield* loadSignedTryoutContent(fixture.attemptId, {
            kind: "signed",
            questions: [],
            answers: [fixture.answer],
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: {
            _tag: "ContentExecutionError",
            stage: "module",
            contentKey: fixture.answer.contentKey,
          },
        });
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect("rechecks the live session after successful rendering", () =>
    Effect.gen(function* () {
      const fixture = yield* readOwnedFixture({
        compiledCode:
          'return { default: function Content() { return "Complete retained body"; } };',
      });
      yield* loadSignedTryoutContent(fixture.attemptId, fixture.access);
      expect(cacheMock).toHaveBeenCalledOnce();
      expect(queryMock.mock.invocationCallOrder[0]).toBeLessThan(
        cacheMock.mock.invocationCallOrder[0] ?? 0
      );
      vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 366 * 24 * 60 * 60 * 1000));
      expect(
        yield* loadSignedTryoutContent(fixture.attemptId, fixture.access).pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: "ContentRuntimeVerificationError",
        cause: { _tag: "ContentRuntimeMissingError" },
      });
      expect(queryMock).toHaveBeenCalledTimes(2);
      expect(cacheMock).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "rejects absent or failed sessions before querying any attempt",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readOwnedFixture();
        tokenMock.mockResolvedValueOnce(null);
        expect(
          yield* loadSignedTryoutContent(
            fixture.attemptId,
            fixture.access
          ).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: "Try-out content requires an active session.",
        });
        const cause = new TypeError("Session transport unavailable.");
        tokenMock.mockRejectedValueOnce(cause);
        expect(
          yield* loadSignedTryoutContent(
            fixture.attemptId,
            fixture.access
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentRuntimeVerificationError", cause });
        expect(queryMock).not.toHaveBeenCalled();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "preserves live authorization failures without entering rendering",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readOwnedFixture();
        const cause = new TypeError("Authorization query unavailable.");
        queryMock.mockRejectedValueOnce(cause);
        expect(
          yield* loadSignedTryoutContent(
            fixture.attemptId,
            fixture.access
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "ContentRuntimeVerificationError", cause });
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );
});
