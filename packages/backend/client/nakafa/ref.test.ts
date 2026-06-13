import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import {
  buildNakafaContentRef,
  createNakafaContentRefFromGraphProjection,
  getNakafaContentResourceUri,
} from "@repo/contents/_lib/agent/refs";
import { LocaleSchema } from "@repo/contents/_types/content";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const ContentIdArgsSchema = Schema.Struct({
  contentId: Schema.String,
});
const RouteArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  route: Schema.String,
});

const convexUrl = "https://example.convex.cloud";
const articleRoute = "articles/politics/example";
const articleRef = buildNakafaContentRef("en", articleRoute, "articles");
const detachedArticleRef = createDetachedArticleRef();

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("resolveNakafaContentRef", () => {
  it("resolves graph content IDs and resource URIs through the route catalog", async () => {
    const graphRef = await Effect.runPromise(
      resolveNakafaContentRef(convexUrl, articleRef.content_id)
    );
    const resourceRef = await Effect.runPromise(
      resolveNakafaContentRef(
        convexUrl,
        getNakafaContentResourceUri(articleRef.content_id)
      )
    );

    expect(Option.getOrUndefined(graphRef)).toStrictEqual(articleRef);
    expect(Option.getOrUndefined(resourceRef)).toStrictEqual(articleRef);
    expect(runtimeMocks.fetchConvexRuntimeQuery).toHaveBeenCalledTimes(2);
  });

  it("preserves graph fields returned by the route catalog", async () => {
    const ref = await Effect.runPromise(
      resolveNakafaContentRef(convexUrl, detachedArticleRef.content_id)
    );

    expect(Option.getOrUndefined(ref)).toStrictEqual(detachedArticleRef);
  });

  it("resolves canonical public URLs through the route catalog", async () => {
    const ref = await Effect.runPromise(
      resolveNakafaContentRef(
        convexUrl,
        "https://nakafa.com/en/articles/politics/example"
      )
    );

    expect(Option.getOrUndefined(ref)).toStrictEqual(detachedArticleRef);
    expect(runtimeMocks.fetchConvexRuntimeQuery).toHaveBeenCalledWith(
      convexUrl,
      api.contents.queries.runtime.getContentRoute,
      {
        locale: "en",
        route: articleRoute,
      }
    );
  });

  it("rejects bare route refs at the Convex-backed runtime seam", async () => {
    const localizedRoute = await Effect.runPromise(
      resolveNakafaContentRef(convexUrl, `en/${articleRoute}`)
    );
    const localeFreeRoute = await Effect.runPromise(
      resolveNakafaContentRef(convexUrl, articleRoute)
    );

    expect(Option.isNone(localizedRoute)).toBe(true);
    expect(Option.isNone(localeFreeRoute)).toBe(true);
    expect(runtimeMocks.fetchConvexRuntimeQuery).not.toHaveBeenCalled();
  });
});

/** Routes generated Convex query refs to content-ref resolver fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: unknown
) {
  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getContentRouteByContentId)
  ) {
    return Promise.resolve(readContentRouteByContentId(args));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getContentRoute)
  ) {
    return Promise.resolve(readContentRoute(args));
  }

  return Promise.reject(new Error("Unhandled content-ref query fixture."));
}

/** Builds one route lookup fixture from a graph asset ID. */
function readContentRouteByContentId(args: unknown) {
  const input = Schema.decodeUnknownSync(ContentIdArgsSchema)(args);

  if (input.contentId === articleRef.content_id) {
    return {
      ...articleRef,
      title: "Article",
    };
  }

  if (input.contentId === detachedArticleRef.content_id) {
    return {
      ...detachedArticleRef,
      title: "Detached article",
    };
  }

  return null;
}

function readContentRoute(args: unknown) {
  const input = Schema.decodeUnknownSync(RouteArgsSchema)(args);

  if (
    input.locale === detachedArticleRef.locale &&
    input.route === articleRoute
  ) {
    return {
      ...detachedArticleRef,
      title: "Detached article",
    };
  }

  return null;
}

/** Creates a graph ref whose IDs intentionally do not derive from its route. */
function createDetachedArticleRef() {
  const ref = createNakafaContentRefFromGraphProjection({
    alignmentId: "alignment:catalog:article:example",
    assetId: "asset:en:catalog:article:example",
    conceptId: "concept:catalog:article:example",
    content_id: "asset:en:catalog:article:example",
    learningObjectId: "lo:catalog:article:example",
    lensId: "lens:catalog:article:example",
    locale: "en",
    route: articleRoute,
    section: "articles",
  });

  if (Option.isNone(ref)) {
    throw new Error("Detached article test ref must be valid.");
  }

  return ref.value;
}
