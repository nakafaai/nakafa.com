import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";

const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);
const recover = Ref.getFunctionReference(refs.internal.nina.lifecycle.recover);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);
const halted = Ref.getFunctionReference(refs.internal.nina.phase.halted);

describe("The halted phase of a Nina turn", () => {
  it("tells a run to halt once its turn was stopped, settled or removed", async () => {
    const f = await createNinaTest();
    await f.t.mutation(claim, { turnId: f.turnId });
    expect(await f.t.query(halted, { turnId: f.turnId })).toBe(false);
    await f.owner.mutation(cancel, { chatId: f.chatId });
    expect(await f.t.query(halted, { turnId: f.turnId })).toBe(true);
    await f.t.mutation(recover, { turnId: f.turnId });
    expect(await f.t.query(halted, { turnId: f.turnId })).toBe(true);
    await f.t.mutation((ctx) => ctx.db.delete("ninaTurns", f.turnId));
    expect(await f.t.query(halted, { turnId: f.turnId })).toBe(true);
  });
});
