import { ConfigProvider, Effect } from "effect";
import { describe, expect, it } from "vitest";
import { readCliEnvironment } from "./environment.js";

describe("Nakafa CLI environment", () => {
  it("reads an optional nonempty isolated-origin secret", async () => {
    const configured = await Effect.runPromise(
      readCliEnvironment().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            NAKAFA_API_EDGE_SECRET: "isolated-secret",
          })
        )
      )
    );
    const absent = await Effect.runPromise(
      readCliEnvironment().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({})
        )
      )
    );

    expect(configured).toEqual({ apiEdgeSecret: "isolated-secret" });
    expect(absent).toEqual({ apiEdgeSecret: undefined });
  });
});
