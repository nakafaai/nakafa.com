import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  decodePlayerMode,
  type PlayerMode,
  readPlayerModeParam,
  resolvePlayerMode,
} from "@/components/player/mode";

describe("player view parameter", () => {
  it.each([
    [{}, { kind: "absent" }],
    [{ view: "list" }, { kind: "valid", mode: "list" }],
    [{ view: "single" }, { kind: "valid", mode: "single" }],
    [{ view: "grid" }, { kind: "invalid" }],
    [{ view: "" }, { kind: "invalid" }],
    [{ view: ["list", "single"] }, { kind: "invalid" }],
  ])("classifies %j", (searchParams, expected) => {
    expect(readPlayerModeParam(searchParams)).toEqual(expected);
  });

  it("ignores every other parameter", () => {
    expect(readPlayerModeParam({ attemptId: "attempt-id" })).toEqual({
      kind: "absent",
    });
  });
});

describe("decodePlayerMode", () => {
  it("reads a view and treats anything else as none", () => {
    expect(decodePlayerMode("single")).toEqual(Option.some("single"));
    expect(decodePlayerMode("list")).toEqual(Option.some("list"));
    expect(decodePlayerMode("grid")).toEqual(Option.none());
    expect(decodePlayerMode(undefined)).toEqual(Option.none());
  });
});

describe("resolvePlayerMode", () => {
  const saved = Option.some<PlayerMode>("single");

  it("lets the address win over the saved view", () => {
    expect(
      resolvePlayerMode({
        cookie: saved,
        param: { kind: "valid", mode: "list" },
      })
    ).toBe("list");
  });

  it("uses the saved view when the address names none", () => {
    expect(
      resolvePlayerMode({ cookie: saved, param: { kind: "absent" } })
    ).toBe("single");
  });

  it("starts with the list when nothing names a view", () => {
    expect(
      resolvePlayerMode({ cookie: Option.none(), param: { kind: "absent" } })
    ).toBe("list");
  });
});
