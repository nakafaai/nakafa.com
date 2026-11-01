import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  connectedService,
  connectFailure,
} from "@/components/connectors/outcome";

describe("connect outcome", () => {
  it("tells only the card that tried how its connect ended badly", () => {
    const refused = { connect: "refused", connector: "classroom" } as const;
    const failed = { connect: "failed", connector: "classroom" } as const;

    expect(connectFailure(refused, "classroom")).toEqual(
      Option.some("refused")
    );
    expect(connectFailure(failed, "classroom")).toEqual(Option.some("failed"));
    expect(connectFailure(refused, "drive")).toEqual(Option.none());
  });

  it("has nothing to say after a good end, a stop, or no connect at all", () => {
    expect(
      connectFailure({ connect: "connected", connector: "drive" }, "drive")
    ).toEqual(Option.none());
    expect(
      connectFailure({ connect: "cancelled", connector: "drive" }, "drive")
    ).toEqual(Option.none());
    expect(connectFailure({}, "drive")).toEqual(Option.none());
  });

  it("opens only the service a connect just finished", () => {
    expect(
      connectedService({ connect: "connected", connector: "classroom" })
    ).toEqual(Option.some("classroom"));
    expect(
      connectedService({ connect: "refused", connector: "classroom" })
    ).toEqual(Option.none());
    expect(connectedService({})).toEqual(Option.none());
  });
});
