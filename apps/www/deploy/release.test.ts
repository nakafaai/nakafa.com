// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { ConfigProvider, Effect, Layer } from "effect";
import {
  NoActiveContentRelease,
  readActiveContentRelease,
} from "#www/deploy/release";

/** The Convex answer of the page catalog, which each test chooses. */
const queryMock = vi.hoisted(() => vi.fn());

/** Receives the address of each client that a read builds. */
const clientAddress = vi.hoisted(() => vi.fn());

vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) => {
        clientAddress(args[0]);
        return Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return { ...client, query: queryMock };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args)));
      },
    },
  };
});

/** Reads the active release with the deploy's Convex address. */
function readRelease() {
  return readActiveContentRelease().pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord({
        VITE_CONVEX_URL: "https://quiet-otter-1.convex.cloud",
      })
    )
  );
}

beforeEach(() => {
  queryMock.mockReset();
  clientAddress.mockReset();
});

describe("readActiveContentRelease", () => {
  it.effect(
    "reads the active release from the deployment that the build reads",
    () =>
      Effect.gen(function* () {
        queryMock.mockReturnValue(
          Effect.succeed({
            activeReleaseId: "legal-xendit-20261026",
            managed: true,
            projectionJson: [],
          })
        );

        expect(yield* readRelease()).toBe("legal-xendit-20261026");
        expect(queryMock).toHaveBeenCalledWith(contentRelease.page.catalog, {});
        expect(clientAddress).toHaveBeenCalledWith(
          "https://quiet-otter-1.convex.cloud"
        );
      })
  );

  it.effect(
    "fails the deploy when no release is active, since the build cannot render one",
    () =>
      Effect.gen(function* () {
        queryMock.mockReturnValue(
          Effect.succeed({
            activeReleaseId: null,
            managed: false,
            projectionJson: [],
          })
        );

        const failure = yield* readRelease().pipe(Effect.flip);

        expect(failure).toBeInstanceOf(NoActiveContentRelease);
      })
  );
});
