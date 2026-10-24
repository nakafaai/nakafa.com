import { describe, expect, it } from "@effect/vitest";
import worker from "@/front/worker";

describe("worker", () => {
  it("answers each fetch through the front", async () => {
    const response = await worker.fetch(
      new Request("https://cas.nakafa.test/health"),
      {
        CAS_SOLVER: {
          idFromName: (name) => name,
          get: () => ({ fetch: () => Promise.reject(new Error("unused")) }),
        },
        MATH_CAS_API_KEY: undefined,
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
