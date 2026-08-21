import {
  getContentReferenceInput,
  resolveNakafaContentRef,
} from "@repo/backend/client/nakafa/ref";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: toRuntimeQueryError,
      try: () => runtimeMocks.runtimeQuery(url, query, args),
    }),
}));

function toRuntimeQueryError(cause: unknown) {
  if (cause instanceof ConvexRuntimeQueryError) {
    return cause;
  }

  return new ConvexRuntimeQueryError({
    networkCodes: [],
    query: "test-runtime-query",
    reason: "query",
  });
}

const convexUrl = "https://example.convex.cloud";
const articleRoute = "articles/politics/example";
const articleRef = readNakafaContentRefFixture("en", articleRoute, "articles");
const material = makeMaterialProjection("en", 1);

beforeEach(() => {
  runtimeMocks.runtimeQuery.mockReset();
  runtimeMocks.runtimeQuery.mockImplementation(readReferenceFixture);
});

describe("resolveNakafaContentRef", () => {
  it("normalizes graph IDs and canonical public URLs into one current input", () => {
    expect(getContentReferenceInput(material.graph.assetId)).toEqual(
      Option.some({
        contentId: material.graph.assetId,
        kind: "content",
      })
    );
    expect(
      getContentReferenceInput(
        `https://nakafa.com/${material.appLocale}/${material.publicPath}`
      )
    ).toEqual(
      Option.some({
        appLocale: material.appLocale,
        kind: "route",
        publicPath: material.publicPath,
      })
    );
    expect(getContentReferenceInput("not-content")).toEqual(Option.none());
  });

  it("resolves graph content IDs and resource URIs through the current seam", async () => {
    const graphRef = await Effect.runPromise(
      resolveNakafaContentRef(convexUrl, articleRef.content_id)
    );
    const resourceRef = await Effect.runPromise(
      resolveNakafaContentRef(
        convexUrl,
        `nakafa://content/${articleRef.content_id}`
      )
    );

    expect(Option.getOrUndefined(graphRef)).toStrictEqual(articleRef);
    expect(Option.getOrUndefined(resourceRef)).toStrictEqual(articleRef);
    expect(runtimeMocks.runtimeQuery).toHaveBeenCalledTimes(2);
  });

  it("resolves canonical public URLs through the current seam", async () => {
    const ref = await Effect.runPromise(
      resolveNakafaContentRef(
        convexUrl,
        "https://nakafa.com/en/articles/politics/example"
      )
    );

    expect(Option.getOrUndefined(ref)).toStrictEqual(articleRef);
    expect(runtimeMocks.runtimeQuery).toHaveBeenCalledWith(
      convexUrl,
      api.contentRelease.reference.read,
      {
        input: {
          appLocale: "en",
          kind: "route",
          publicPath: articleRoute,
        },
      }
    );
  });

  it("rejects bare route refs without querying Convex", async () => {
    const localizedRoute = await Effect.runPromise(
      resolveNakafaContentRef(convexUrl, `en/${articleRoute}`)
    );
    const localeFreeRoute = await Effect.runPromise(
      resolveNakafaContentRef(convexUrl, articleRoute)
    );

    expect(Option.isNone(localizedRoute)).toBe(true);
    expect(Option.isNone(localeFreeRoute)).toBe(true);
    expect(runtimeMocks.runtimeQuery).not.toHaveBeenCalled();
  });
});

/** Returns one current reference fixture through the sole query Interface. */
function readReferenceFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: {
    readonly input?: {
      readonly contentId?: string;
      readonly publicPath?: string;
    };
  }
) {
  if (
    getFunctionName(query) !==
    getFunctionName(api.contentRelease.reference.read)
  ) {
    return Promise.reject(new Error("Unhandled content reference query."));
  }
  const matchesContent = args.input?.contentId === articleRef.content_id;
  const matchesRoute = args.input?.publicPath === articleRef.route;
  return Promise.resolve(matchesContent || matchesRoute ? articleRef : null);
}
