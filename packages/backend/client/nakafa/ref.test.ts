import { resolveNakafaContentRef } from "@repo/backend/client/nakafa/ref";
import { api } from "@repo/backend/convex/_generated/api";
import {
  buildNakafaContentRef,
  getNakafaContentResourceUri,
} from "@repo/contents/_lib/agent/refs";
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

const convexUrl = "https://example.convex.cloud";
const articleRoute = "articles/politics/example";
const articleRef = buildNakafaContentRef("en", articleRoute, "articles");

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

  it("accepts canonical public URLs only as route projections", async () => {
    const ref = await Effect.runPromise(
      resolveNakafaContentRef(
        convexUrl,
        "https://nakafa.com/en/articles/politics/example"
      )
    );

    expect(Option.getOrUndefined(ref)).toStrictEqual(articleRef);
    expect(runtimeMocks.fetchConvexRuntimeQuery).not.toHaveBeenCalled();
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

  return Promise.reject(new Error("Unhandled content-ref query fixture."));
}

/** Builds one route lookup fixture from a graph asset ID. */
function readContentRouteByContentId(args: unknown) {
  const input = Schema.decodeUnknownSync(ContentIdArgsSchema)(args);

  if (input.contentId !== articleRef.content_id) {
    return null;
  }

  return {
    ...articleRef,
    title: "Article",
  };
}
