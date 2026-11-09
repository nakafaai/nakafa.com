import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  type AddressRouter,
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
  const navigate = vi.fn<AddressRouter["navigate"]>(() => Promise.resolve());
  const router = { navigate };

  beforeEach(() => {
    navigate.mockClear();
    window.history.replaceState(null, "", "/set?attemptId=x#q");
  });

  it.effect(
    "writes the parameter through the router as a replace that leaves the page where it is",
    () =>
      Effect.gen(function* () {
        yield* replaceSearchParam(router, "question", Option.some("4"));

        expect(navigate).toHaveBeenCalledExactlyOnceWith({
          hashScrollIntoView: false,
          href: "/set?attemptId=x&question=4#q",
          replace: true,
          resetScroll: false,
        });
      })
  );

  it.effect("takes the parameter away", () =>
    Effect.gen(function* () {
      window.history.replaceState(null, "", "/set?attemptId=x&question=4#q");

      yield* replaceSearchParam(router, "question", Option.none());

      expect(navigate).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ href: "/set?attemptId=x#q" })
      );
    })
  );

  it.effect("leaves an address that already says it alone", () =>
    Effect.gen(function* () {
      yield* replaceSearchParam(router, "question", Option.none());

      expect(navigate).not.toHaveBeenCalled();
    })
  );
});
