// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  DUPLEX,
  octamerOf,
  pathOf,
  seated,
  solenoidOf,
  strandsOf,
  stringOf,
  WRAP,
  wrapOf,
} from "@repo/design-system/components/contents/biology/chromosome/coil";
import {
  length,
  sub,
} from "@repo/design-system/components/three/molecule/point";
import { Array as Arr, Option } from "effect";

describe("DNA around the histone octamer", () => {
  it("wraps 1.65 left-handed turns at 4.18 nm from the superhelix axis", () => {
    const wrap = wrapOf(148);
    Arr.forEach(wrap, ([x, y]) => {
      expect(Math.hypot(x, y)).toBeCloseTo(WRAP.radius);
    });
    const first = wrap[0] ?? [0, 0, 0];
    const last = Option.getOrElse(Arr.last(wrap), () => [0, 0, 0] as const);
    expect(first[2] - last[2]).toBeCloseTo(WRAP.turns * WRAP.pitch);
    expect(wrap[1]?.[2]).toBeLessThan(first[2]);
  });

  it("holds eight histones, two of each kind, inside the wrap", () => {
    const octamer = octamerOf();
    expect(octamer).toHaveLength(8);
    Arr.forEach([0, 1, 2, 3], (kind) => {
      expect(
        Arr.filter(octamer, (histone) => histone.kind === kind)
      ).toHaveLength(2);
    });
    Arr.forEach(octamer, (histone) => {
      expect(length(histone.at)).toBeLessThan(WRAP.radius - DUPLEX.radius);
    });
  });

  it("keeps both backbones 1 nm from the axis and turns them once every 3.57 nm", () => {
    const axis = Arr.makeBy(106, (index) => [index * 0.34, 0, 0] as const);
    const { first, second } = strandsOf(axis);
    expect(first).toHaveLength(105);
    Arr.forEach(Arr.zip(first, second), ([one, two], index) => {
      const middle = [(index + 1) * 0.34, 0, 0] as const;
      expect(length(sub(one, middle))).toBeCloseTo(DUPLEX.radius);
      expect(length(sub(two, middle))).toBeCloseTo(DUPLEX.radius);
      expect(length(sub(one, two))).toBeCloseTo(
        2 * Math.sin((127 * Math.PI) / 360)
      );
    });
    const turn = Math.round(DUPLEX.period / 0.34);
    expect(
      length(sub(first[0] ?? [0, 0, 0], first[turn] ?? [0, 0, 0]))
    ).toBeCloseTo(turn * 0.34, 0);
  });
});

describe("nucleosomes along a chromatin fibre", () => {
  it("seats a nucleosome by turning it about x and moving it", () => {
    const [x, y, z] = seated([1, 0, 2], { at: [10, 0, 0], tilt: Math.PI / 2 });
    expect(x).toBeCloseTo(11);
    expect(y).toBeCloseTo(-2);
    expect(z).toBeCloseTo(0);
  });

  it("strings beads some 21 nm apart and threads one DNA through them", () => {
    const seats = stringOf(4);
    expect(seats).toHaveLength(4);
    expect((seats[1]?.at[0] ?? 0) - (seats[0]?.at[0] ?? 0)).toBeCloseTo(21);
    expect(pathOf(seats, 24)).toHaveLength(96);
  });

  it("coils six nucleosomes a turn into a solenoid 11 nm a turn", () => {
    const seats = solenoidOf(12);
    Arr.forEach(seats, (seat) => {
      expect(Math.hypot(seat.at[1], seat.at[2])).toBeCloseTo(10.5);
    });
    expect((seats[6]?.at[0] ?? 0) - (seats[0]?.at[0] ?? 0)).toBeCloseTo(11);
    expect(seats[6]?.at[1]).toBeCloseTo(seats[0]?.at[1] ?? 0);
    const face = seated([0, 0, 1], {
      at: [0, 0, 0],
      tilt: seats[0]?.tilt ?? 0,
    });
    expect(face[1]).toBeCloseTo(1);
  });
});
