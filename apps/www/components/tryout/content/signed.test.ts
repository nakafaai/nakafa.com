// @vitest-environment node

// Node tests isolate Next navigation imports while real semantic renderers execute.
vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { readSnapshotProtectedContent } from "@repo/backend/client/content/protected";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { ContentSnapshotError } from "@repo/backend/content/snapshot/error";
import { readFeaturedTryout } from "@repo/backend/content/tryout/featured";
import { readTryoutSection } from "@repo/backend/content/tryout/section";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { makeTryoutStartPlacement } from "@repo/backend/test/tryout/source";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import type { TryoutAnswerSelector } from "@/components/tryout/content/model";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
import {
  loadSignedTryoutContent,
  loadTryoutQuestion,
} from "@/components/tryout/content/signed";
import { ContentRuntimeConfigurationError } from "@/lib/content/published/errors";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import { createTestSnapshotContext } from "@/test/content/snapshot";

const loadSnapshotMock = vi.hoisted(() => vi.fn());
const runtimeKeysMock = vi.hoisted(() => vi.fn());
const runtimeSiteMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const siteUrl = "https://runtime.example.test";
const endpoint = `${siteUrl}${PROTECTED_CONTENT_RUNTIME_PATH}`;

vi.mock("@/lib/content/runtime/snapshot", () => ({
  loadContentSnapshot: loadSnapshotMock,
}));
vi.mock("@/lib/content/cache", () => ({
  applyPublishedContentBatchCache: cacheMock,
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

/** Selects genuine retained question and answer identities from signed serving rows. */
const readFixture = Effect.fn("TryoutExecutionTest.fixture")(function* (
  compiledCode?: string
) {
  const source = yield* makeTryoutRuntimeSource(compiledCode);
  const context = yield* createTestSnapshotContext(source.source);
  const featured = yield* readFeaturedTryout("en").pipe(
    Effect.provideContext(context)
  );
  const route = makeTryoutStartPlacement("en");
  const section = yield* readTryoutSection({ ...route, locale: "en" }).pipe(
    Effect.provideContext(context)
  );
  const { row } = yield* Effect.fromNullishOr(section.placements[0]);
  const answer: TryoutAnswerSelector = {
    ...featured.question,
    artifactHash: row.answerArtifactHash,
    contentKey: row.answerContentKey,
    delivery: "entitled",
  };
  return { answer, context, question: featured.question };
});

beforeEach(() => {
  loadSnapshotMock.mockReset();
  cacheMock.mockReset();
  fetchMock.mockReset();
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
    "renders a signed snapshot question without reading live credentials or site configuration",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        loadSnapshotMock.mockResolvedValue(fixture.context);
        runtimeSiteMock.mockImplementation(() => {
          throw new ContentRuntimeConfigurationError({
            key: "CONTENT_RUNTIME_TOKEN",
          });
        });
        const rendered = yield* loadTryoutQuestion(fixture.question);

        expect(renderToStaticMarkup(rendered.content)).toBe(
          "Technical question"
        );
        expect(rendered).toMatchObject({
          contentHash: fixture.question.contentHash,
          sourcePath: fixture.question.sourcePath,
          sourceRevision: fixture.question.sourceRevision,
        });
        expect(runtimeKeysMock).not.toHaveBeenCalled();
        expect(runtimeSiteMock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(cacheMock).toHaveBeenCalledWith("question", [
          fixture.question.artifactHash,
        ]);
      })
  );

  it.effect(
    "preserves the question and answer partitions after real signed batch execution",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture(
          'return { default: function Content() { return "Retained body"; } };'
        );
        loadSnapshotMock.mockResolvedValue(fixture.context);
        const rendered = yield* loadSignedTryoutContent({
          kind: "signed",
          questions: [fixture.question],
          answers: [fixture.answer],
        });

        expect(rendered.questions).toHaveLength(1);
        expect(rendered.answers).toHaveLength(1);
        const question = yield* Effect.fromNullishOr(rendered.questions[0]);
        const answer = yield* Effect.fromNullishOr(rendered.answers[0]);
        expect(renderToStaticMarkup(question.content)).toBe("Retained body");
        expect(renderToStaticMarkup(answer.answer)).toBe("Retained body");
        expect(cacheMock).toHaveBeenCalledWith("question", [
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
        const renderer = yield* rendererManifest;
        const found = yield* readSnapshotProtectedContent(
          request,
          renderer
        ).pipe(Effect.provideContext(fixture.context));
        const response = new Response(JSON.stringify(found), {
          headers: {
            "content-type": "application/json",
            [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
          },
          status: 200,
        });
        Object.defineProperty(response, "url", { value: endpoint });
        fetchMock.mockResolvedValueOnce(response);
        loadSnapshotMock.mockResolvedValue(undefined);
        runtimeKeysMock.mockReturnValue({
          CONTENT_RUNTIME_TOKEN: "technical-test-token",
        });

        const rendered = yield* loadTryoutQuestion(fixture.question);
        expect(renderToStaticMarkup(rendered.content)).toBe(
          "Technical question"
        );
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(runtimeKeysMock).toHaveBeenCalledOnce();
        expect(cacheMock).toHaveBeenCalledWith("question", [
          fixture.question.artifactHash,
        ]);
      })
  );

  it.effect(
    "rejects a missing ordered item at the real exchange boundary before executing MDX",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture(
          "throw new TypeError('must not execute an incomplete exchange');"
        );
        const request = yield* makeTryoutRuntimeRequest([
          fixture.question,
          fixture.answer,
        ]);
        const renderer = yield* rendererManifest;
        const found = yield* readSnapshotProtectedContent(
          request,
          renderer
        ).pipe(Effect.provideContext(fixture.context));
        const response = new Response(
          JSON.stringify({ ...found, items: found.items.slice(0, 1) }),
          {
            headers: {
              "content-type": "application/json",
              [CONTENT_RUNTIME_RESPONSE_HEADER]:
                CONTENT_RUNTIME_RESPONSE_MARKER,
            },
            status: 200,
          }
        );
        Object.defineProperty(response, "url", { value: endpoint });
        fetchMock.mockResolvedValueOnce(response);
        loadSnapshotMock.mockResolvedValue(undefined);
        runtimeKeysMock.mockReturnValue({
          CONTENT_RUNTIME_TOKEN: "technical-test-token",
        });

        expect(
          yield* loadSignedTryoutContent({
            kind: "signed",
            questions: [fixture.question],
            answers: [fixture.answer],
          }).pipe(Effect.flip)
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
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "rejects an empty exported access before transport or caching",
    () =>
      Effect.gen(function* () {
        expect(
          yield* loadSignedTryoutContent({
            kind: "signed",
            questions: [],
            answers: [],
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: "Protected content batch is empty.",
        });
        expect(loadSnapshotMock).not.toHaveBeenCalled();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "preserves a missing live credential as a typed configuration cause",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        loadSnapshotMock.mockResolvedValue(undefined);
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
    "preserves a snapshot read failure without trying the live transport",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        loadSnapshotMock.mockRejectedValue(
          new ContentSnapshotError({ message: "Snapshot unavailable" })
        );
        expect(
          yield* loadTryoutQuestion(fixture.question).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: { _tag: "ContentSnapshotError" },
        });
        expect(runtimeKeysMock).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "preserves authenticated module failures and never caches incomplete rendering",
    () =>
      Effect.gen(function* () {
        const fixture = yield* readFixture();
        loadSnapshotMock.mockResolvedValue(fixture.context);
        expect(
          yield* loadSignedTryoutContent({
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
});
