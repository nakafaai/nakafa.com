import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  guardianCodeOf,
  guardianEmailOf,
  guardianSignInAnswerOf,
  SIGN_IN_START,
  stepSignIn,
} from "@/components/tenant/guardian/code";

describe("the sign-in's steps", () => {
  const mailed = stepSignIn(SIGN_IN_START, {
    _tag: "sent",
    address: "ibu.siti@example.com",
  });

  it("writes the field of the step the parent is on", () => {
    expect(stepSignIn(SIGN_IN_START, { _tag: "typed", text: "ibu" })).toEqual({
      ...SIGN_IN_START,
      email: "ibu",
    });
    expect(stepSignIn(mailed, { _tag: "typed", text: "042" })).toEqual({
      ...mailed,
      code: "042",
    });
  });

  it("moves to an empty code of the mailed address, and drops the sentence", () => {
    const refused = stepSignIn(SIGN_IN_START, {
      _tag: "refused",
      message: "Failed",
    });

    expect(
      stepSignIn(refused, { _tag: "sent", address: "ibu.siti@example.com" })
    ).toEqual({
      _tag: "code",
      code: "",
      message: undefined,
      sentTo: "ibu.siti@example.com",
    });
  });

  it("goes back to the address the parent typed, to correct it, and stays there", () => {
    const typed = stepSignIn(mailed, { _tag: "typed", text: "042917" });
    const back = stepSignIn(typed, { _tag: "back" });

    expect(back).toEqual({
      _tag: "email",
      email: "ibu.siti@example.com",
      message: undefined,
    });
    expect(stepSignIn(back, { _tag: "back" })).toEqual(back);
  });

  it("empties the code on a resend, and keeps the code step", () => {
    const typed = stepSignIn(mailed, { _tag: "typed", text: "042917" });

    expect(
      stepSignIn(typed, { _tag: "sent", address: "ibu.siti@example.com" })
    ).toEqual(mailed);
  });

  it("keeps what was typed through a refusal, and clears the sentence when a request starts", () => {
    const typed = stepSignIn(mailed, { _tag: "typed", text: "042917" });
    const refused = stepSignIn(typed, { _tag: "refused", message: "Wrong" });

    expect(refused).toEqual({ ...typed, message: "Wrong" });
    expect(stepSignIn(refused, { _tag: "waiting" })).toEqual(typed);
  });
});

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
