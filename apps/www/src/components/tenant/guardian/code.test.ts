import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  guardianCodeOf,
  guardianEmailOf,
  guardianSignInAnswerOf,
} from "@/components/tenant/guardian/code";

describe("guardian sign-in", () => {
  it("reads an address as the link holds it, and refuses text that is no address", () => {
    expect(guardianEmailOf("  Ibu.Siti@Example.com ")).toEqual(
      Option.some("ibu.siti@example.com")
    );
    expect(Option.isNone(guardianEmailOf("ibu siti"))).toBe(true);
  });

  it("reads six digits with spaces dropped, and nothing else", () => {
    expect(guardianCodeOf(" 042 917 ")).toEqual(Option.some("042917"));
    expect(Option.isNone(guardianCodeOf("04291"))).toBe(true);
    expect(Option.isNone(guardianCodeOf("04291a"))).toBe(true);
  });

  it.effect(
    "reads a refusal below 500, and leaves a server failure unanswered",
    () =>
      Effect.gen(function* () {
        expect(yield* guardianSignInAnswerOf(undefined)).toBe(true);
        expect(yield* guardianSignInAnswerOf(401)).toBe(false);
        const failure = yield* Effect.flip(guardianSignInAnswerOf(502));
        expect(failure._tag).toBe("GuardianSignInUnanswered");
      })
  );
});
