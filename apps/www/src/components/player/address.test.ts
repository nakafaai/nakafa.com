import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  addressOf,
  readAddressedKey,
  replaceSearchParam,
} from "@/components/player/address";

const KEYS = ["a", "b", "c"];

describe("readAddressedKey", () => {
  it("names the question whose number the address holds", () => {
    expect(readAddressedKey("?attemptId=x&question=3", KEYS)).toEqual(
      Option.some("c")
    );
  });

  it.each([
    ["no number", "?attemptId=x"],
    ["a number past the paper", "?question=4"],
    ["no whole number", "?question=1.5"],
    ["a number under 1", "?question=0"],
    ["no number at all", "?question=last"],
  ])("names no question for %s", (_case, search) => {
    expect(readAddressedKey(search, KEYS)).toEqual(Option.none());
  });
});

describe("addressOf", () => {
  it("holds the number of a question after the first", () => {
    expect(addressOf(KEYS, "b")).toEqual(Option.some("2"));
  });

  it("holds nothing for the first question, or for none", () => {
    expect(addressOf(KEYS, "a")).toEqual(Option.none());
    expect(addressOf(KEYS, null)).toEqual(Option.none());
  });
});

describe("replaceSearchParam", () => {
  beforeEach(() => {
    window.history.replaceState({ key: "kept" }, "", "/set?attemptId=x#q");
  });

  it("writes the parameter in place and keeps the entry's state", () => {
    const length = window.history.length;

    replaceSearchParam("question", Option.some("4"));

    expect(window.location.search).toBe("?attemptId=x&question=4");
    expect(window.location.hash).toBe("#q");
    expect(window.history.state).toEqual({ key: "kept" });
    expect(window.history.length).toBe(length);
  });

  it("takes the parameter away", () => {
    replaceSearchParam("question", Option.some("4"));

    replaceSearchParam("question", Option.none());

    expect(window.location.search).toBe("?attemptId=x");
  });

  it("leaves an address that already says it alone", () => {
    const replace = vi.spyOn(window.history, "replaceState");

    replaceSearchParam("question", Option.none());

    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });
});
