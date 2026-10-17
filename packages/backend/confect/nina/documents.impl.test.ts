import { Ref } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaModel } from "@repo/backend/test/nina";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const run = Ref.getFunctionReference(refs.internal.nina.documents.run);

describe("Nina documents run", () => {
  afterEach(() => {
    provider.languageModel.mockReset();
  });

  it("answers a turn in the Node runtime and settles it complete", async () => {
    provider.languageModel.mockReturnValue(ninaModel());
    const f = await createNinaTest({ prompt: "Summarize the attached notes." });

    await f.t.action(run, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turn?.state).toMatchObject({ status: "complete" });
  });
});
