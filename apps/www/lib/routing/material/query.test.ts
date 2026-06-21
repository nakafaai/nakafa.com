import { describe, expect, it } from "vitest";
import {
  readMaterialContextQuery,
  toMaterialContextQueryString,
} from "@/lib/routing/material/query";

describe("material context query", () => {
  it("parses and serializes the route-owned material context query parameter", () => {
    expect(readMaterialContextQuery("?ctx=merdeka~linear")).toEqual({
      nodeKey: "linear",
      programKey: "merdeka",
    });
    expect(readMaterialContextQuery("?ctx=malformed")).toBeUndefined();
    expect(toMaterialContextQueryString(undefined)).toBe("");
    expect(
      toMaterialContextQueryString({
        nodeKey: "linear",
        programKey: "merdeka",
      })
    ).toBe("?ctx=merdeka~linear");
  });
});
