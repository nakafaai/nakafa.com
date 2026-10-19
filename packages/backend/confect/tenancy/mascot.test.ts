import { describe, expect, it } from "@effect/vitest";
import { schoolMascot } from "@repo/backend/confect/tenancy/mascot";
import { MascotCode } from "@repo/mascot/code";
import { Array as Arr, Schema } from "effect";

describe("tenancy/mascot", () => {
  it("gives a school the same animal every time for the same address", () => {
    expect(schoolMascot("harapan")).toEqual(schoolMascot("harapan"));
  });

  it("stores the animal as its code, which reads back to the same animal", () => {
    const mascot = schoolMascot("harapan");
    const stored = Schema.encodeSync(MascotCode)(mascot);

    expect(Schema.decodeSync(MascotCode)(stored)).toEqual(mascot);
  });

  it("gives schools with different addresses more than one animal", () => {
    const animals = Arr.map(
      Arr.range(1, 40),
      (index) => schoolMascot(`school-${index}`).animal
    );

    expect(Arr.dedupe(animals).length).toBeGreaterThan(1);
  });
});
