import {
  getMaterialPath,
  parseMaterial,
} from "@repo/contents/_lib/subject/route";
import { describe, expect, it } from "vitest";

describe("subject route helpers", () => {
  it("builds material routes", () => {
    expect(getMaterialPath("high-school", "10", "biology")).toBe(
      "/subject/high-school/10/biology"
    );
  });

  it("parses valid material segments and rejects invalid ones", () => {
    expect(parseMaterial("biology")).toBe("biology");
    expect(parseMaterial("not-a-material")).toBeNull();
  });
});
