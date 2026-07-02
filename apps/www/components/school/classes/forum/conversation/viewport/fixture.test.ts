import { describe, expect, it } from "vitest";
import { conversationTestFirstPost as firstPost } from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  createAdapters,
  makePostMeasurement,
} from "@/components/school/classes/forum/conversation/viewport/fixture";

describe("conversation/viewport/fixture", () => {
  it("exposes settled semantics through the fixture scroller", () => {
    const rig = createAdapters();

    expect(rig.adapters.scroller.isViewSettled({ kind: "bottom" })).toBe(true);
    rig.setMeasurement(makePostMeasurement(firstPost._id));
    expect(
      rig.adapters.scroller.isViewSettled({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(true);
    rig.setMeasurement(null);
    expect(rig.adapters.scroller.isViewSettled({ kind: "bottom" })).toBe(false);
  });
});
