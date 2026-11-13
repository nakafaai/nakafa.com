import { afterEach, describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  decodePlayerMode,
  type PlayerMode,
  readBrowserPlayerMode,
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
        phone: true,
      })
    ).toBe("list");
  });

  it("uses the saved view when the address names none", () => {
    expect(
      resolvePlayerMode({
        cookie: Option.some("list"),
        param: { kind: "absent" },
        phone: true,
      })
    ).toBe("list");
    expect(
      resolvePlayerMode({
        cookie: saved,
        param: { kind: "absent" },
        phone: false,
      })
    ).toBe("single");
  });

  it("starts a phone one question at a time and anything wider with the list when nothing names a view", () => {
    expect(
      resolvePlayerMode({
        cookie: Option.none(),
        param: { kind: "absent" },
        phone: true,
      })
    ).toBe("single");
    expect(
      resolvePlayerMode({
        cookie: Option.none(),
        param: { kind: "absent" },
        phone: false,
      })
    ).toBe("list");
  });
});

describe("readBrowserPlayerMode", () => {
  /** A browser as wide as a phone or wider, by the query `matchMedia` answers. */
  const widthOf = (phone: boolean) =>
    vi.stubGlobal("window", {
      matchMedia: (query: string) => ({ matches: phone, media: query }),
    });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a phone one question at a time and a wider browser with the list when nothing names a view", () => {
    vi.stubGlobal("document", { cookie: "theme=dark" });
    widthOf(true);
    expect(readBrowserPlayerMode({ kind: "absent" })).toBe("single");
    widthOf(false);
    expect(readBrowserPlayerMode({ kind: "absent" })).toBe("list");
  });

  it("reads the view the learner saved in this browser when the address names none", () => {
    widthOf(false);
    vi.stubGlobal("document", { cookie: "theme=dark; player_view=single" });
    expect(readBrowserPlayerMode({ kind: "absent" })).toBe("single");
  });

  it("prefers the address, and reads the device's view for a saved view it does not know", () => {
    widthOf(false);
    vi.stubGlobal("document", { cookie: "player_view=single" });
    expect(readBrowserPlayerMode({ kind: "valid", mode: "list" })).toBe("list");
    vi.stubGlobal("document", { cookie: "player_view=grid" });
    expect(readBrowserPlayerMode({ kind: "absent" })).toBe("list");
  });
});
