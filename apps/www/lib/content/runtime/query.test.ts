// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

const { fetchMock, productionUrl, readMock, runtimeEnv, runtimeUrl } =
  vi.hoisted(() => {
    const isolatedUrl = "http://127.0.0.1:3210";
    const publicUrl = "https://production.example";
    return {
      fetchMock: vi.fn(),
      productionUrl: publicUrl,
      readMock: vi.fn(),
      runtimeEnv: {
        CONTENT_BUILD_URL: isolatedUrl as string | undefined,
        NEXT_PUBLIC_CONVEX_URL: publicUrl,
      },
      runtimeUrl: isolatedUrl,
    };
  });

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: readMock,
}));

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchMock }));

vi.mock("@/env", () => ({
  env: runtimeEnv,
}));

const input = {
  input: {
    appLocale: "en",
    kind: "route",
    publicPath: "articles/politics/test",
  },
} as const;

beforeEach(() => {
  fetchMock.mockReset();
  readMock.mockReset();
  runtimeEnv.CONTENT_BUILD_URL = runtimeUrl;
});

describe("content runtime query", () => {
  it("keeps direct prerender reads inside the isolated build", async () => {
    fetchMock.mockResolvedValueOnce(42);
    await expect(
      fetchRuntimeQuery(api.contentRelease.reference.read, input)
    ).resolves.toBe(42);
    expect(fetchMock).toHaveBeenLastCalledWith(
      api.contentRelease.reference.read,
      input,
      { url: runtimeUrl }
    );

    runtimeEnv.CONTENT_BUILD_URL = undefined;
    fetchMock.mockResolvedValueOnce(43);
    await expect(
      fetchRuntimeQuery(api.contentRelease.reference.read, input)
    ).resolves.toBe(43);
    expect(fetchMock).toHaveBeenLastCalledWith(
      api.contentRelease.reference.read,
      input,
      { url: productionUrl }
    );
  });

  it.effect("maps isolated build reads into the typed data-read channel", () =>
    Effect.gen(function* () {
      readMock.mockReturnValueOnce(Effect.succeed(42));
      expect(
        yield* readRuntimeQuery(api.contentRelease.reference.read, input)
      ).toBe(42);

      const runtimeError = new ConvexRuntimeQueryError({
        httpStatuses: [],
        networkCodes: ["EPIPE"],
        query: "contentRelease.material.route",
        reason: "transport",
      });
      readMock.mockReturnValueOnce(Effect.fail(runtimeError));
      const failure = yield* readRuntimeQuery(
        api.contentRelease.reference.read,
        input
      ).pipe(Effect.flip);

      expect(failure).toMatchObject({
        cause: runtimeError.message,
        message:
          "Unable to read Nakafa runtime content query: contentRelease.material.route.",
      });
      expect(readMock).toHaveBeenCalledWith(
        runtimeUrl,
        api.contentRelease.reference.read,
        input
      );
    })
  );

  it.effect("keeps normal server reads on the public runtime", () =>
    Effect.gen(function* () {
      runtimeEnv.CONTENT_BUILD_URL = undefined;
      readMock.mockReturnValueOnce(Effect.succeed(42));

      expect(
        yield* readRuntimeQuery(api.contentRelease.reference.read, input)
      ).toBe(42);
      expect(readMock).toHaveBeenCalledWith(
        productionUrl,
        api.contentRelease.reference.read,
        input
      );
    })
  );
});
