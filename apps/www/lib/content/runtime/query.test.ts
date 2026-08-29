// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";
import { vi } from "vitest";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

const { readMock, runtimeUrl } = vi.hoisted(() => ({
  readMock: vi.fn(),
  runtimeUrl: "https://runtime.example",
}));

vi.mock("@repo/backend/client/runtime", async (importOriginal) => ({
  ...(await importOriginal()),
  readConvexRuntimeQuery: readMock,
}));

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: runtimeUrl },
}));

describe("content runtime query", () => {
  it.effect(
    "maps the Effect runtime query into the typed data-read channel",
    () =>
      Effect.gen(function* () {
        readMock.mockReturnValueOnce(Effect.succeed(42));
        expect(
          yield* readRuntimeQuery(api.contentRelease.reference.read, {
            input: {
              appLocale: "en",
              kind: "route",
              publicPath: "articles/politics/test",
            },
          })
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
          {
            input: {
              appLocale: "en",
              kind: "route",
              publicPath: "articles/politics/test",
            },
          }
        ).pipe(Effect.flip);

        expect(failure).toMatchObject({
          cause: runtimeError.message,
          message:
            "Unable to read Nakafa runtime content query: contentRelease.material.route.",
        });
        expect(readMock).toHaveBeenCalledWith(
          runtimeUrl,
          api.contentRelease.reference.read,
          {
            input: {
              appLocale: "en",
              kind: "route",
              publicPath: "articles/politics/test",
            },
          }
        );
      })
  );
});
