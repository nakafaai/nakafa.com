import { describe, expect, it } from "@effect/vitest";
import { createConvexTestWithAuth } from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { REDIRECT } from "@repo/backend/test/agent/grant";
import { Array as Arr } from "effect";

/** Registers one agent with the given metadata. */
function register(
  t: ReturnType<typeof createConvexTestWithAuth>,
  name: string,
  redirectUris: readonly string[]
) {
  return t.mutation(api.auth.grant.register, {
    name,
    redirectUris: [...redirectUris],
  });
}

describe("auth/grant/register", () => {
  it("registers a public agent under the name it gives, trimmed", async () => {
    const t = createConvexTestWithAuth();
    const { clientId } = await register(t, "  Claude Desktop  ", [
      REDIRECT,
      "http://127.0.0.1:33418/callback",
      "com.example.agent:/callback",
    ]);
    await expect(
      t.query((ctx) => ctx.db.get("agentClients", clientId))
    ).resolves.toMatchObject({
      name: "Claude Desktop",
      redirectUris: [
        REDIRECT,
        "http://127.0.0.1:33418/callback",
        "com.example.agent:/callback",
      ],
    });
  });

  it.each([
    ["an empty name", "   "],
    ["a name over 200 characters", "a".repeat(201)],
  ])("refuses %s", async (_case, name) => {
    const t = createConvexTestWithAuth();
    await expect(register(t, name, [REDIRECT])).rejects.toMatchObject({
      data: { _tag: "AgentRefused", error: "invalid_client_metadata" },
    });
  });

  it.each([
    ["no redirect address", []],
    [
      "more than ten addresses",
      Arr.makeBy(11, (index) => `${REDIRECT}/${index}`),
    ],
    ["a relative address", ["/callback"]],
    ["an address with a fragment", [`${REDIRECT}#code`]],
    ["an address over 2048 characters", [`${REDIRECT}?q=${"x".repeat(2048)}`]],
  ])("refuses %s", async (_case, redirectUris) => {
    const t = createConvexTestWithAuth();
    await expect(register(t, "Agent", redirectUris)).rejects.toMatchObject({
      data: { _tag: "AgentRefused", error: "invalid_redirect_uri" },
    });
  });

  it("slows registrations down past twenty an hour", async () => {
    const t = createConvexTestWithAuth();
    for (let index = 0; index < 20; index += 1) {
      await register(t, `Agent ${index}`, [REDIRECT]);
    }
    await expect(register(t, "One too many", [REDIRECT])).rejects.toMatchObject(
      { data: { _tag: "AgentRefused", error: "slow_down" } }
    );
    await expect(
      t.query((ctx) => ctx.db.query("agentClients").collect())
    ).resolves.toHaveLength(20);
  });
});
