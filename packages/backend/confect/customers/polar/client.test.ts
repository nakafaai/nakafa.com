import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { readPolarClient } from "@repo/backend/confect/customers/polar/client";
import { ConfigProvider, Effect } from "effect";

const polarFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.stubGlobal("fetch", polarFetch);

const configured = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromEnv({ env: { POLAR_ACCESS_TOKEN: "polar_test" } })
);

beforeEach(() => polarFetch.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("Polar client configuration", () => {
  it.effect(
    "sends each request to the environment the deployment selects, sandbox by default",
    () =>
      Effect.gen(function* () {
        const cases = [
          {
            env: {
              POLAR_ACCESS_TOKEN: "polar_test",
              NEXT_PUBLIC_POLAR_SERVER: "production",
            },
            origin: "https://api.polar.sh",
          },
          {
            env: {
              POLAR_ACCESS_TOKEN: "polar_test",
              NEXT_PUBLIC_POLAR_SERVER: "sandbox",
            },
            origin: "https://sandbox-api.polar.sh",
          },
          {
            env: { POLAR_ACCESS_TOKEN: "polar_test" },
            origin: "https://sandbox-api.polar.sh",
          },
        ];
        for (const { env, origin } of cases) {
          polarFetch.mockReset();
          polarFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
          const client = yield* readPolarClient().pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({ env })
            )
          );
          yield* Effect.promise(() =>
            client.sendRequest(client.buildRequest("GET", "/v1/customers/"))
          );
          expect(new URL(String(polarFetch.mock.calls[0][0])).origin).toBe(
            origin
          );
        }
      })
  );
  it.effect("sends the access token and the 2026-04 API version", () =>
    Effect.gen(function* () {
      const client = yield* readPolarClient().pipe(configured);
      const [, init] = client.buildRequest("GET", "/v1/customers/");
      const headers = new Headers(init.headers);
      expect(headers.get("Authorization")).toBe("Bearer polar_test");
      expect(headers.get("Polar-Version")).toBe("2026-04");
    })
  );
  it.effect("gives every request thirty seconds before it times out", () =>
    Effect.gen(function* () {
      const timeout = vi.spyOn(AbortSignal, "timeout");
      polarFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
      const client = yield* readPolarClient().pipe(configured);
      yield* Effect.promise(() =>
        client.sendRequest(client.buildRequest("GET", "/v1/customers/"))
      );
      expect(timeout).toHaveBeenCalledWith(30_000);
    })
  );
  it.effect(
    "rejects absent credentials and invalid environments without exposing secrets",
    () =>
      Effect.gen(function* () {
        for (const env of [
          {},
          { POLAR_ACCESS_TOKEN: "" },
          {
            POLAR_ACCESS_TOKEN: "polar_test",
            NEXT_PUBLIC_POLAR_SERVER: "invalid",
          },
        ]) {
          const error = yield* readPolarClient().pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({ env })
            ),
            Effect.flip
          );
          expect(error._tag).toBe("PolarConfigError");
          expect(error.message).not.toContain("polar_test");
        }
      })
  );
});
