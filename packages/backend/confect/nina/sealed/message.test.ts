import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import {
  copyOf,
  sealThreadIn,
  withoutRowIds,
} from "@repo/backend/test/nina/seal";
import {
  messageFailureIn,
  readMessageIn,
} from "@repo/backend/test/nina/sealed";
import { createThreadTest } from "@repo/backend/test/nina/thread";

describe("reading one message through the sealed module", () => {
  it("reads a sealed prompt as the plain prompt reads it", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    const plain = await readMessageIn(f.t, owner, f.promptMessageId);
    const replacements = await sealThreadIn(f.t, f.identity.threadId, owner);
    const sealed = await readMessageIn(
      f.t,
      owner,
      copyOf(replacements, f.promptMessageId)
    );
    expect(withoutRowIds(sealed)).toEqual(withoutRowIds(plain));
    expect(sealed?.text).toBe("Explain a limit.");
  });

  it("reads null for a message the component no longer holds", async () => {
    const f = await createThreadTest();
    const owner = f.identity.userId;
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [f.promptMessageId],
      })
    );
    expect(await readMessageIn(f.t, owner, f.promptMessageId)).toBeNull();
  });

  it("fails with a sealed read error for an id that names no message", async () => {
    const f = await createThreadTest();
    const failure = await messageFailureIn(
      f.t,
      f.identity.userId,
      "not-a-message"
    );
    expect(failure).toBe("SealedReadError");
  });
});
