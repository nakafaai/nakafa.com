import { describe, expect, it } from "@effect/vitest";
import {
  readMaterialContextQuery,
  toMaterialContextQueryString,
} from "@/lib/routing/material/query";

const context = { nodeKey: "linear", programKey: "merdeka" };

describe("material context query", () => {
  it("reads the route-owned material context hint of the query string", () => {
    expect(readMaterialContextQuery("?ctx=merdeka~linear")).toEqual(context);
    expect(readMaterialContextQuery("ctx=merdeka~linear&other=value")).toEqual(
      context
    );
  });

  it("writes the canonical query string, which reads back to the same identity", () => {
    expect(toMaterialContextQueryString(context)).toBe("?ctx=merdeka~linear");
    expect(
      readMaterialContextQuery(toMaterialContextQueryString(context))
    ).toEqual(context);
    expect(
      readMaterialContextQuery(
        toMaterialContextQueryString({ nodeKey: "kelas 11", programKey: "k" })
      )
    ).toEqual({ nodeKey: "kelas 11", programKey: "k" });
  });

  it("writes an empty suffix for no context", () => {
    expect(toMaterialContextQueryString(undefined)).toBe("");
  });

  it("reads an absent, malformed, or other-shaped value as no context", () => {
    expect(readMaterialContextQuery("")).toBeUndefined();
    expect(readMaterialContextQuery("?ctx=malformed")).toBeUndefined();
    expect(readMaterialContextQuery("?ctx=~linear")).toBeUndefined();
    expect(readMaterialContextQuery("?other=merdeka~linear")).toBeUndefined();
    expect(
      readMaterialContextQuery("?ctx[node]=merdeka~linear")
    ).toBeUndefined();
  });

  it("reads a repeated context key as no context", () => {
    expect(
      readMaterialContextQuery("?ctx=merdeka~linear&ctx=merdeka~node")
    ).toBeUndefined();
  });
});
