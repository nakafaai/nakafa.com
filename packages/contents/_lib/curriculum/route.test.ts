import {
  getMaterialPath,
  parseMaterial,
} from "@repo/contents/_lib/curriculum/route";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("curriculum route helpers", () => {
  it("builds material routes", () => {
    expect(getMaterialPath("high-school", "10", "biology")).toBe(
      "/curriculum/high-school/10/biology"
    );
  });

  it("parses valid material segments and rejects invalid ones", () => {
    expect(Option.getOrUndefined(parseMaterial("biology"))).toBe("biology");
    expect(Option.isNone(parseMaterial("not-a-material"))).toBe(true);
  });
});
