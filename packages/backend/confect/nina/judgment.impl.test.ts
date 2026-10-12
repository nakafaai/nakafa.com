import { Ref } from "@confect/core";
import { afterEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { decides, deployment, provider } from "@repo/backend/test/gateway";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

const measure = Ref.getFunctionReference(refs.internal.nina.judgment.measure);

afterEach(() => {
  deployment.mockReset();
  provider.decisionModel.mockReset();
});

describe("the measuring of the judgments", () => {
  it("measures the texts it is given, and reports the thresholds the deployment holds", async () => {
    const t = createConvexTestWithBetterAuth();
    decides((judgment) => (judgment === "lasting" ? 0.77 : 0.23));
    expect(
      await t.action(measure, {
        texts: ["Kelas 12", "Terima kasih"],
        together: 1,
      })
    ).toEqual({
      rows: [
        { probabilities: { lasting: 0.77, private: 0.23 } },
        { probabilities: { lasting: 0.77, private: 0.23 } },
      ],
      thresholds: {
        lasting: judgments.lasting.threshold,
        private: judgments.private.threshold,
      },
    });
  });

  it("fails with the typed error and asks nothing when the deployment cannot use the gateway", async () => {
    const t = createConvexTestWithBetterAuth();
    deployment.mockReturnValueOnce(
      Effect.fail(
        new GatewayConfigurationError({
          message: "The AI gateway is not available on this deployment.",
        })
      )
    );
    await expect(
      t.action(measure, { texts: ["Kelas 12"], together: 1 })
    ).rejects.toMatchObject({ data: { _tag: "GatewayConfigurationError" } });
    expect(provider.decisionModel).not.toHaveBeenCalled();
  });
});
