import { internal } from "@repo/backend/convex/_generated/api";
import {
  AuthorSyncResultSchema,
  CountTablePageSchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type { ConvexConfig } from "@repo/backend/scripts/sync-content/contract/types";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Cause, ConfigProvider, Effect, Exit, Schema } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const config: ConvexConfig = {
  accessToken: "test-token",
  url: "https://example.convex.cloud",
};
const configFilePath = "/tmp/test-home/.convex/config.json";
const warningMock = vi.fn();

let configFileContent: string | undefined = JSON.stringify({
  accessToken: "local-token",
});

type Adapter =
  typeof import("@repo/backend/scripts/sync-content/convex/client");
type BulkSyncAuthors =
  typeof internal.contentSync.mutations.authors.bulkSyncAuthors;
type CountTablePage = typeof internal.contentSync.queries.counts.countTablePage;
type PopulateAudioQueue =
  typeof internal.contents.actions.queue.populateAudioQueue;

interface CapturedRequest {
  init: RequestInit | undefined;
  input: RequestInfo | URL;
}

vi.mock("node:fs", () => ({
  /** Reads the mocked local Convex auth config file. */
  readFileSync: (path: string) => {
    if (path !== configFilePath || configFileContent === undefined) {
      throw new Error("Missing mocked Convex config file.");
    }

    return configFileContent;
  },
}));

vi.mock("node:os", () => ({
  /** Returns a deterministic home directory for local Convex auth config tests. */
  homedir: () => "/tmp/test-home",
}));

vi.mock("@repo/backend/scripts/sync-content/cli/logging", () => ({
  /** Records production-mode warnings emitted by the adapter config loader. */
  logWarning: (message: string) => warningMock(message),
}));

/** Imports the adapter after test module mocks are registered. */
const loadAdapter = async (): Promise<Adapter> =>
  await import("@repo/backend/scripts/sync-content/convex/client");

/** Builds a JSON Convex HTTP response envelope. */
const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });

/** Builds a non-OK response whose text reader fails. */
const createFailedTextResponse = () => {
  const response = new Response("", { status: 500 });
  Object.defineProperty(response, "text", {
    value: () => Promise.reject(new Error("body read failed")),
  });

  return response;
};

/** Stubs fetch and records each adapter request. */
const stubFetch = (response: Response) => {
  const requests: CapturedRequest[] = [];
  /** Records one request and resolves with the supplied response. */
  const fetchMock: typeof fetch = (input, init) => {
    requests.push({ input, init });

    return Promise.resolve(response);
  };

  vi.stubGlobal("fetch", fetchMock);

  return requests;
};

/** Stubs fetch with a transport-level rejection. */
const stubRejectedFetch = (error: unknown) => {
  /** Rejects each request with the supplied transport error. */
  const fetchMock: typeof fetch = () => Promise.reject(error);
  vi.stubGlobal("fetch", fetchMock);
};

/** Returns the only request captured by the fetch stub. */
const getOnlyRequest = (requests: readonly CapturedRequest[]) => {
  expect(requests).toHaveLength(1);

  const request = requests[0];
  if (!request) {
    throw new Error("Expected one Convex request.");
  }

  return request;
};

/** Parses a captured JSON request body. */
const getRequestBody = (request: CapturedRequest): unknown => {
  if (typeof request.init?.body !== "string") {
    throw new Error("Expected a JSON request body.");
  }

  return JSON.parse(request.init.body);
};

/** Renders the expected failure cause from an adapter effect. */
const getFailureMessage = async <A, E>(effect: Effect.Effect<A, E, never>) => {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    throw new Error("Expected the Convex adapter to fail.");
  }

  return Cause.pretty(exit.cause);
};

/** Runs an effect with deterministic Convex URL configuration. */
const withConfig = <A, E>(
  effect: Effect.Effect<A, E, never>,
  values: Map<string, string>
) => effect.pipe(Effect.withConfigProvider(ConfigProvider.fromMap(values)));

/** Calls the generated author sync mutation through the adapter. */
const callAuthors = (
  adapter: Adapter,
  response: Response | undefined = createJsonResponse({
    status: "success",
    value: { created: 1, existing: 0 },
  })
) => {
  if (response) {
    stubFetch(response);
  }

  return adapter.callConvexMutation(
    config,
    internal.contentSync.mutations.authors.bulkSyncAuthors,
    { authorNames: ["Nabil"] },
    AuthorSyncResultSchema
  );
};

afterEach(() => {
  configFileContent = JSON.stringify({ accessToken: "local-token" });
  warningMock.mockClear();
  vi.doUnmock("convex/server");
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("sync-content Convex adapter", () => {
  it("posts typed args to the generated mutation path", async () => {
    const adapter = await loadAdapter();
    const requests = stubFetch(
      createJsonResponse({
        status: "success",
        value: { created: 1, existing: 0 },
      })
    );
    const args: FunctionArgs<BulkSyncAuthors> = { authorNames: ["Nabil"] };

    const result: FunctionReturnType<BulkSyncAuthors> = await Effect.runPromise(
      adapter.callConvexMutation(
        config,
        internal.contentSync.mutations.authors.bulkSyncAuthors,
        args,
        AuthorSyncResultSchema
      )
    );

    const request = getOnlyRequest(requests);
    expect(String(request.input)).toBe(
      "https://example.convex.cloud/api/mutation"
    );
    expect(request.init?.headers).toEqual({
      Authorization: "Convex test-token",
      "Content-Type": "application/json",
    });
    expect(getRequestBody(request)).toEqual({
      args,
      format: "json",
      path: "contentSync/mutations/authors:bulkSyncAuthors",
    });
    expect(result).toEqual({ created: 1, existing: 0 });
  });

  it("posts generated query and action references to their endpoints", async () => {
    const adapter = await loadAdapter();
    const queryRequests = stubFetch(
      createJsonResponse({
        status: "success",
        value: { continueCursor: "cursor", isDone: true, pageSize: 1 },
      })
    );
    const queryArgs: FunctionArgs<CountTablePage> = {
      paginationOpts: { cursor: null, numItems: 1 },
      tableName: "authors",
    };

    const queryResult: FunctionReturnType<CountTablePage> =
      await Effect.runPromise(
        adapter.callConvexQuery(
          config,
          internal.contentSync.queries.counts.countTablePage,
          queryArgs,
          CountTablePageSchema
        )
      );

    expect(String(getOnlyRequest(queryRequests).input)).toBe(
      "https://example.convex.cloud/api/query"
    );
    expect(queryResult).toEqual({
      continueCursor: "cursor",
      isDone: true,
      pageSize: 1,
    });

    const actionRequests = stubFetch(
      createJsonResponse({ status: "success", value: null })
    );
    const actionArgs: FunctionArgs<PopulateAudioQueue> = {};
    const actionResult: FunctionReturnType<PopulateAudioQueue> =
      await Effect.runPromise(
        adapter.callConvexAction(
          config,
          internal.contents.actions.queue.populateAudioQueue,
          actionArgs,
          Schema.Null
        )
      );

    expect(String(getOnlyRequest(actionRequests).input)).toBe(
      "https://example.convex.cloud/api/action"
    );
    expect(actionResult).toBeNull();
  });

  it("reports Convex envelope errors with generated function context", async () => {
    const adapter = await loadAdapter();
    const message = await getFailureMessage(
      await callAuthors(
        adapter,
        createJsonResponse({ errorMessage: "Nope", status: "error" })
      )
    );

    expect(message).toContain("contentSync/mutations/authors:bulkSyncAuthors");
    expect(message).toContain("Nope");

    const fallbackMessage = await getFailureMessage(
      await callAuthors(adapter, createJsonResponse({ status: "error" }))
    );
    expect(fallbackMessage).toContain("Unknown Convex error");
  });

  it("reports HTTP and transport failures through typed request errors", async () => {
    const adapter = await loadAdapter();
    const httpMessage = await getFailureMessage(
      await callAuthors(adapter, new Response("Server failed", { status: 500 }))
    );
    expect(httpMessage).toContain("HTTP 500 Server failed");

    const bodyMessage = await getFailureMessage(
      await callAuthors(adapter, createFailedTextResponse())
    );
    expect(bodyMessage).toContain("body read failed");

    stubRejectedFetch("network down");
    const networkMessage = await getFailureMessage(
      adapter.callConvexMutation(
        config,
        internal.contentSync.mutations.authors.bulkSyncAuthors,
        { authorNames: ["Nabil"] },
        AuthorSyncResultSchema
      )
    );
    expect(networkMessage).toContain("network down");
  });

  it("reports malformed envelopes and invalid values through schema decoding", async () => {
    const adapter = await loadAdapter();
    const jsonMessage = await getFailureMessage(
      await callAuthors(adapter, new Response("not-json", { status: 200 }))
    );
    expect(jsonMessage).toContain("Unexpected token");

    const envelopeMessage = await getFailureMessage(
      await callAuthors(adapter, createJsonResponse({ status: "unexpected" }))
    );
    expect(envelopeMessage).toContain("Invalid Convex response");

    const valueMessage = await getFailureMessage(
      await callAuthors(
        adapter,
        createJsonResponse({ status: "success", value: { created: 1 } })
      )
    );
    expect(valueMessage).toContain("Invalid Convex value");
    expect(valueMessage).toContain("existing");
  });

  it("loads dev and prod Convex config from URL config and local auth", async () => {
    const { getConvexConfig } = await loadAdapter();
    const devConfig = await Effect.runPromise(
      withConfig(getConvexConfig(), new Map([["CONVEX_URL", "dev-url"]]))
    );
    expect(devConfig).toEqual({ accessToken: "local-token", url: "dev-url" });
    expect(warningMock).not.toHaveBeenCalled();

    const prodConfig = await Effect.runPromise(
      withConfig(
        getConvexConfig({ prod: true }),
        new Map([["CONVEX_PROD_URL", "prod-url"]])
      )
    );
    expect(prodConfig).toEqual({
      accessToken: "local-token",
      url: "prod-url",
    });
    expect(warningMock).toHaveBeenCalledWith(
      "PRODUCTION MODE: Syncing to prod-url"
    );
  });

  it("reports missing URL config for dev and prod targets", async () => {
    const { getConvexConfig } = await loadAdapter();
    const devMessage = await getFailureMessage(
      withConfig(getConvexConfig(), new Map())
    );
    expect(devMessage).toContain("CONVEX_URL not set. Run: npx convex dev");

    const prodMessage = await getFailureMessage(
      withConfig(getConvexConfig({ prod: true }), new Map())
    );
    expect(prodMessage).toContain("CONVEX_PROD_URL not set");
  });

  it("reports missing, invalid, and tokenless local auth config", async () => {
    const { getConvexConfig } = await loadAdapter();
    const values = new Map([["CONVEX_URL", "dev-url"]]);

    configFileContent = undefined;
    const missingMessage = await getFailureMessage(
      withConfig(getConvexConfig(), values)
    );
    expect(missingMessage).toContain("Not authenticated. Run: npx convex dev");

    configFileContent = "{";
    const invalidJsonMessage = await getFailureMessage(
      withConfig(getConvexConfig(), values)
    );
    expect(invalidJsonMessage).toContain(
      "Invalid Convex config. Run: npx convex dev"
    );

    configFileContent = JSON.stringify({ accessToken: 1 });
    const invalidSchemaMessage = await getFailureMessage(
      withConfig(getConvexConfig(), values)
    );
    expect(invalidSchemaMessage).toContain(
      "Invalid Convex config. Run: npx convex dev"
    );

    configFileContent = JSON.stringify({});
    const missingTokenMessage = await getFailureMessage(
      withConfig(getConvexConfig(), values)
    );
    expect(missingTokenMessage).toContain(
      "No access token. Run: npx convex dev"
    );
  });

  it("reports generated function path failures without sending a request", async () => {
    vi.resetModules();
    vi.doMock("convex/server", async () => {
      const actual =
        await vi.importActual<typeof import("convex/server")>("convex/server");

      return {
        ...actual,
        getFunctionName: () => {
          throw new Error("bad generated reference");
        },
      };
    });
    const adapter = await loadAdapter();
    const requests = stubFetch(createJsonResponse({ status: "success" }));

    const message = await getFailureMessage(
      adapter.callConvexMutation(
        config,
        internal.contentSync.mutations.authors.bulkSyncAuthors,
        { authorNames: ["Nabil"] },
        AuthorSyncResultSchema
      )
    );

    expect(message).toContain("bad generated reference");
    expect(requests).toHaveLength(0);
  });
});
