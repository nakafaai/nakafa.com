import { describe, expect, it } from "@effect/vitest";
import { accountMascot } from "@repo/backend/confect/users/mascot";
import { MascotCode } from "@repo/mascot/code";
import { Array as Arr, Schema } from "effect";

describe("users/mascot", () => {
  it("gives an account the same animal every time for the same auth id", () => {
    expect(accountMascot("auth-ada")).toEqual(accountMascot("auth-ada"));
  });

  it("stores the animal as its code, which reads back to the same animal", () => {
    const mascot = accountMascot("auth-ada");
    const stored = Schema.encodeSync(MascotCode)(mascot);

    expect(Schema.decodeSync(MascotCode)(stored)).toEqual(mascot);
  });

  it("gives accounts with different auth ids more than one animal", () => {
    const animals = Arr.map(
      Arr.range(1, 40),
      (index) => accountMascot(`auth-${index}`).animal
    );

    expect(Arr.dedupe(animals).length).toBeGreaterThan(1);
  });
});
