import { describe, expect, it } from "@effect/vitest";
import { DESIGNS } from "@repo/mascot/animal";
import { contrast, Ground, groundsFor } from "@repo/mascot/ground";
import { Array as Arr, Record as Rec, Schema } from "effect";

const HEX_DIGITS = /^[0-9a-f]{6}$/u;

describe("mascot/ground", () => {
  it("lists 22 grounds, each of six lower-case hexadecimal digits", () => {
    expect(Ground.literals).toHaveLength(22);
    expect(Arr.dedupe(Ground.literals)).toHaveLength(22);
    expect(
      Arr.every(Ground.literals, (ground) => HEX_DIGITS.test(ground))
    ).toBe(true);
  });

  it("accepts only a listed ground, not any colour", () => {
    expect(Schema.is(Ground)("243e66")).toBe(true);
    expect(Schema.is(Ground)("243e67")).toBe(false);
    expect(Schema.is(Ground)("#243e66")).toBe(false);
  });

  it("measures contrast from 1 for one colour up to 21 for black on white", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 10);
    expect(contrast("#243e66", "#243e66")).toBe(1);
    expect(contrast("#f6f4ef", "#243e66")).toBe(contrast("#243e66", "#f6f4ef"));
  });

  it("reads a colour with or without its leading #", () => {
    expect(contrast("#ee8a4c", "243e66")).toBe(contrast("ee8a4c", "#243e66"));
  });

  it("keeps exactly the grounds that a body stands out from", () => {
    const body = "#f6f4ef";
    const fit = groundsFor(body);
    expect(fit.length).toBeGreaterThan(0);
    expect(fit.length).toBeLessThan(Ground.literals.length);
    expect(Arr.every(fit, (ground) => contrast(body, ground) >= 2.4)).toBe(
      true
    );
    expect(
      Arr.every(
        Arr.difference(Ground.literals, fit),
        (ground) => contrast(body, ground) < 2.4
      )
    ).toBe(true);
  });

  it("leaves a ground for every palette of every animal to stand on", () => {
    const bodies = Arr.flatMap(Rec.values(DESIGNS), ({ colors }) =>
      Arr.map(colors, ([body]) => body)
    );
    expect(bodies).toHaveLength(153);
    expect(Arr.every(bodies, (body) => groundsFor(body).length > 0)).toBe(true);
  });
});
