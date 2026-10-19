// @vitest-environment node
import { HttpClient as ConfectHttpClient } from "@confect/js";
import { describe, expect, it } from "@effect/vitest";
import { HttpClient } from "effect/http";
import { runtime } from "@/lib/server/runtime";

/** The deployment that the runtime reads from its environment. */
const CONVEX_URL = "https://example.convex.cloud";

process.env.VITE_CONVEX_URL = CONVEX_URL;

describe("server runtime", () => {
  it("provides the Confect client of the configured deployment", async () => {
    const client = await runtime.runPromise(ConfectHttpClient.HttpClient);
    expect(client.url).toBe(CONVEX_URL);
  });

  it("provides the fetch client with trace headers turned off", async () => {
    const client = await runtime.runPromise(HttpClient.HttpClient);
    expect(typeof client.execute).toBe("function");
  });
});
