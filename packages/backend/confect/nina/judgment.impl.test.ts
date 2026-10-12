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
  it("measures the texts it is given with the judgments it is given, and reports the thresholds the deployment holds for those", async () => {
    const t = createConvexTestWithBetterAuth();
    decides((judgment) => (judgment === "private" ? 0.77 : 0.23));
    expect(
      await t.action(measure, {
        names: ["private", "ownNote"],
        texts: ["Kelas 12", "Terima kasih"],
        together: 1,
      })
    ).toEqual({
      kind: "measured",
      rows: [
        { probabilities: { ownNote: 0.23, private: 0.77 } },
        { probabilities: { ownNote: 0.23, private: 0.77 } },
      ],
      thresholds: {
        ownNote: judgments.ownNote.threshold,
        private: judgments.private.threshold,
      },
    });
  });

  it("answers with the failure and asks nothing when the deployment cannot use the gateway", async () => {
    const t = createConvexTestWithBetterAuth();
    deployment.mockReturnValueOnce(
      Effect.fail(
        new GatewayConfigurationError({
          message: "The AI gateway is not available on this deployment.",
        })
      )
    );
    expect(
      await t.action(measure, {
        names: ["lasting"],
        texts: ["Kelas 12"],
        together: 1,
      })
    ).toEqual({
      failure: {
        _tag: "GatewayConfigurationError",
        message: "The AI gateway is not available on this deployment.",
      },
      kind: "failed",
    });
    expect(provider.decisionModel).not.toHaveBeenCalled();
  });
});
