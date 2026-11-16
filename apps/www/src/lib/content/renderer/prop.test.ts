import { describe, expect, it } from "@effect/vitest";
import { IN_PROP, inPropType } from "@/lib/content/renderer/prop";

describe("lib/content/renderer/prop", () => {
  it("names the component a marked renderer draws with inside a prop", () => {
    const InProp = () => null;
    const Marked = Object.assign(() => null, { [IN_PROP]: InProp });
    const Plain = () => null;

    expect(inPropType(Marked)).toBe(InProp);
    expect(inPropType(Plain)).toBe(Plain);
    expect(inPropType("span")).toBe("span");
  });
});
