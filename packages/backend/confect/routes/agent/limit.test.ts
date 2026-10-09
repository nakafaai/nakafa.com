import { RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { NAKAFA_EDGE_CLIENT_IP_HEADER } from "@repo/backend/agent/edge";
import { enforceAgentReadLimit } from "@repo/backend/confect/routes/agent/limit";
import { runAgentRequest } from "@repo/backend/confect/routes/agent/runtime";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { Effect } from "effect";

afterEach(() => vi.restoreAllMocks());
function request() {
  return new Request("https://api.nakafa.com/search", {
    headers: {
      [NAKAFA_EDGE_CLIENT_IP_HEADER]: "203.0.113.42",
    },
  });
}
describe("public agent quota", () => {
  it.each(["unavailable", "malformed"])(
    "fails closed if quota admission is %s",
    async (failure) => {
      await createConvexTestWithBetterAuth().action(async (ctx) => {
        const runMutation = vi.spyOn(ctx, "runMutation");
        if (failure === "unavailable") {
          runMutation.mockRejectedValueOnce(new Error("quota unavailable"));
        } else {
          runMutation.mockResolvedValueOnce(false);
        }
        const input = request();
        const response = await Effect.runPromise(
          runAgentRequest(
            input,
            "quota-failure",
            enforceAgentReadLimit(input).pipe(
              Effect.as(new Response("admitted"))
            )
          ).pipe(
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
        );
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          code: "SERVICE_UNAVAILABLE",
        });
      });
    }
  );
  it("does not admit unmetered reads when client hashing fails", async () => {
    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("digest unavailable")
    );
    await createConvexTestWithBetterAuth().action(async (ctx) => {
      const input = request();
      const response = await Effect.runPromise(
        runAgentRequest(
          input,
          "identity-failure",
          enforceAgentReadLimit(input).pipe(Effect.as(new Response("admitted")))
        ).pipe(
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
        )
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
    });
  });

  it("does not admit unmetered reads without a usable client identity", async () => {
    for (const address of [undefined, "   ", "1".repeat(257)]) {
      await createConvexTestWithBetterAuth().action(async (ctx) => {
        const headers = new Headers();
        if (address !== undefined) {
          headers.set(NAKAFA_EDGE_CLIENT_IP_HEADER, address);
        }
        const input = new Request("https://api.nakafa.com/search", { headers });
        const response = await Effect.runPromise(
          runAgentRequest(
            input,
            "identity-missing",
            enforceAgentReadLimit(input).pipe(
              Effect.as(new Response("admitted"))
            )
          ).pipe(
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
        );
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          code: "SERVICE_UNAVAILABLE",
        });
      });
    }
  });
});
