// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { NAKAFA_EDGE_CLIENT_IP_HEADER } from "@repo/backend/agent/edge";
import { enforceAgentReadLimit } from "@repo/backend/convex/routes/agent/limit";
import { runAgentRequest } from "@repo/backend/convex/routes/agent/runtime";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

afterEach(() => vi.restoreAllMocks());

function request() {
  return new Request("https://api.nakafa.com/search", {
    headers: { [NAKAFA_EDGE_CLIENT_IP_HEADER]: "203.0.113.42" },
  });
}

describe("public agent quota", () => {
  it("fails closed if the component cannot admit a public read", async () => {
    await createConvexTestWithBetterAuth().action(async (ctx) => {
      vi.spyOn(ctx, "runMutation").mockRejectedValueOnce(
        new Error("quota unavailable")
      );
      const input = request();
      const response = await runAgentRequest(
        input,
        "quota-failure",
        enforceAgentReadLimit(ctx, input).pipe(
          Effect.as(new Response("admitted"))
        )
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
    });
  });

  it("does not admit unmetered reads when client hashing fails", async () => {
    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("digest unavailable")
    );
    await createConvexTestWithBetterAuth().action(async (ctx) => {
      const input = request();
      const response = await runAgentRequest(
        input,
        "identity-failure",
        enforceAgentReadLimit(ctx, input).pipe(
          Effect.as(new Response("admitted"))
        )
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
    });
  });
});
