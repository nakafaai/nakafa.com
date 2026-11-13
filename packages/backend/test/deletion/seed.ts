import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

/** Inserts one app user, deleted or with its cleanup started when `state` says so. */
export function seedDeletionUser(
  ctx: MutationCtx,
  name: string,
  state: {
    readonly deletedAt?: number;
    readonly deletionCleanupStartedAt?: number;
  } = {}
) {
  return ctx.db.insert("users", {
    credits: 0,
    creditsResetAt: 0,
    email: `${name}@example.com`,
    mascot: MASCOT_CODE,
    name,
    plan: "free",
    ...state,
  });
}

/**
 * Lets `count` agents in for one account, as the consent page and the token
 * endpoint leave them: a registered client, its grant, and an unspent code.
 */
export async function seedAccountAgents(
  ctx: MutationCtx,
  userId: Id<"users">,
  count: number,
  now: number
) {
  for (let index = 0; index < count; index += 1) {
    const clientId = await ctx.db.insert("agentClients", {
      name: `Agent ${index}`,
      redirectUris: [`https://agent-${index}.example/callback`],
    });
    await ctx.db.insert("agentGrants", {
      clientId,
      refreshHash: `refresh-${userId}-${index}`,
      refreshedAt: now,
      userId,
    });
    await ctx.db.insert("agentCodes", {
      clientId,
      codeChallenge: `challenge-${index}`,
      codeHash: `code-${userId}-${index}`,
      expiresAt: now + 60_000,
      redirectUri: `https://agent-${index}.example/callback`,
      userId,
    });
  }
}
