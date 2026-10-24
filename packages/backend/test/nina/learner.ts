import { Ref } from "@confect/core";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import type { NinaInput } from "@repo/backend/confect/nina/turns.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);

/**
 * A signed-in Pro learner who converses with Nina one turn at a time. Each
 * `converse` admits the turn as the browser does, generates its answer, and
 * returns its receipt.
 */
export async function createLearnerTest() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, {
      now: Date.UTC(2026, 9, 11),
      credits: 200,
      plan: "pro",
    })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  let requests = 0;
  /** Admits one turn as the browser does, generates its answer, and returns its receipt. */
  async function converse(
    input: typeof NinaInput.Encoded,
    chatId?: Docs["chats"]["_id"]
  ) {
    requests += 1;
    const receipt = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, {
        requestId: `request-${requests}`,
        ...(chatId === undefined ? {} : { chatId }),
        input,
      })
    );
    await t.action(run, { turnId: receipt.turnId });
    return receipt;
  }
  return { converse, t };
}
