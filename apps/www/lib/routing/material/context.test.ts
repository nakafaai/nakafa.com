import { Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  encodeMaterialContextHint,
  MATERIAL_CONTEXT_QUERY_PARAM,
  readMaterialContextHint,
  toContextualMaterialHref,
} from "@/lib/routing/material/context";

const context = {
  nodeKey: "class-11-mathematics-function-composition-inverse-function",
  programKey: "merdeka",
};

describe("material context identity", () => {
  it("round-trips one validated curriculum identity", () => {
    const hint = encodeMaterialContextHint(context);

    expect(hint).toBe(`${context.programKey}~${context.nodeKey}`);
    expect(Option.getOrUndefined(readMaterialContextHint(hint))).toEqual(
      context
    );
  });

  it("drops absent, repeated, empty, and malformed hints", () => {
    expect(Option.isNone(readMaterialContextHint(undefined))).toBe(true);
    expect(Option.isNone(readMaterialContextHint(null))).toBe(true);
    expect(Option.isNone(readMaterialContextHint(["merdeka~node"]))).toBe(true);
    expect(Option.isNone(readMaterialContextHint("merdeka"))).toBe(true);
    expect(Option.isNone(readMaterialContextHint("~node"))).toBe(true);
    expect(Option.isNone(readMaterialContextHint("program~"))).toBe(true);
    expect(Option.isNone(readMaterialContextHint("a~b~c"))).toBe(true);
  });

  it("appends the canonical query key to clean and existing URLs", () => {
    const hint = encodeMaterialContextHint(context);

    expect(toContextualMaterialHref("/en/subjects/math/lesson", context)).toBe(
      `/en/subjects/math/lesson?${MATERIAL_CONTEXT_QUERY_PARAM}=${hint}`
    );
    expect(
      toContextualMaterialHref("/en/subjects/math/lesson?mode=read", context)
    ).toBe(
      `/en/subjects/math/lesson?mode=read&${MATERIAL_CONTEXT_QUERY_PARAM}=${hint}`
    );
  });
});
