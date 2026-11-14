import { describe, expect, it } from "@effect/vitest";
import {
  encodeMaterialContextHint,
  MATERIAL_CONTEXT_HINT_LENGTH,
  readMaterialContextHint,
} from "@repo/contents/route/material/context";

describe("material route context", () => {
  it("reads back the hint a curriculum card writes", () => {
    const context = {
      nodeKey: "class-10-mathematics-linear-equation-inequality",
      programKey: "merdeka",
    };

    expect(readMaterialContextHint(encodeMaterialContextHint(context))).toEqual(
      context
    );
  });

  it("ignores missing, malformed, or mismatched material context hints", () => {
    expect(readMaterialContextHint("merdeka~node")).toEqual({
      nodeKey: "node",
      programKey: "merdeka",
    });
    expect(readMaterialContextHint(["merdeka~node"])).toBeUndefined();
    expect(readMaterialContextHint("merdeka")).toBeUndefined();
    expect(readMaterialContextHint("~node")).toBeUndefined();
    // A hint takes no more characters than a public route may hold.
    const room = MATERIAL_CONTEXT_HINT_LENGTH - "merdeka~".length;
    expect(readMaterialContextHint(`merdeka~${"n".repeat(room)}`)).toEqual({
      nodeKey: "n".repeat(room),
      programKey: "merdeka",
    });
    expect(
      readMaterialContextHint(`merdeka~${"n".repeat(room + 1)}`)
    ).toBeUndefined();
  });
});
