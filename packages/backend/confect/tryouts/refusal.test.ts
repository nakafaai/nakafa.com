import { describe, expect, it } from "@effect/vitest";
import {
  AttemptClosed,
  AttemptRefused,
  Expired,
  Locked,
  Missing,
  OtherDevice,
  SectionClosed,
} from "@repo/backend/confect/assessment/gate/refusal";
import { toTryoutFailure } from "@repo/backend/confect/tryouts/refusal";
import { GATE_NOW, tryoutRefusals } from "@repo/backend/test/tryout/gate";
import { Struct } from "effect";

describe("tryouts/refusal", () => {
  it("maps every refusal onto the error its function declares", () => {
    const reasons = {
      AttemptClosed: new AttemptClosed(),
      Expired: new Expired({ deadline: GATE_NOW }),
      Locked: new Locked(),
      Missing: new Missing(),
      OtherDevice: new OtherDevice(),
      SectionClosed: new SectionClosed(),
    };
    for (const write of Struct.keys(tryoutRefusals)) {
      for (const tag of Struct.keys(reasons)) {
        const failure = toTryoutFailure[write](
          new AttemptRefused({ reason: reasons[tag] })
        );
        expect(Struct.pick(failure, ["_tag", "code"])).toEqual(
          tryoutRefusals[write][tag]
        );
      }
    }
  });
});
