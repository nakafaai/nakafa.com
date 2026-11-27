// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  forkOf,
  SPREAD,
  spreadAt,
} from "@repo/design-system/components/contents/biology/dna/fork";
import { basesOf } from "@repo/design-system/components/contents/biology/dna/strand";
import {
  HELIX_RISE,
  helixOf,
} from "@repo/design-system/components/three/molecule/nucleic";
import { Array as Arr, Option } from "effect";

const STRETCH = basesOf("GATTACACGTGCATGCAATG", "dna");

describe("a stretch of DNA at the replication fork", () => {
  it("is one whole double helix before copying starts", () => {
    const [helix, ...rest] = forkOf(STRETCH, "dna", 0);
    expect(rest).toHaveLength(0);
    expect(helix?.fresh).toStrictEqual([false, false]);
    expect(helix?.steps).toHaveLength(20);
    Arr.forEach(helix?.steps ?? [], (step, index) => {
      expect(step.shift).toBe(0);
      expect(step.rise).toBeCloseTo(index * HELIX_RISE);
      expect(step.second).toBeDefined();
    });
  });

  it("pulls the parents apart past the fork and lays a new partner on each", () => {
    const [upper, lower] = forkOf(STRETCH, "dna", 0.5);
    expect(upper?.steps[5]).toMatchObject({
      first: "C",
      second: "G",
      shift: 0,
    });
    expect(upper?.steps[10]).toMatchObject({ first: "G", second: undefined });
    expect(upper?.steps[19]).toMatchObject({
      first: "G",
      second: "C",
      shift: SPREAD,
    });
    expect(lower?.start).toBe(9);
    expect(lower?.steps[0]).toMatchObject({ first: undefined, second: "A" });
    expect(Option.getOrUndefined(Arr.last(lower?.steps ?? []))).toMatchObject({
      first: "G",
      second: "C",
      shift: -SPREAD,
    });
    expect(spreadAt(10, 20, 0.5)).toBeGreaterThan(0);
    expect(spreadAt(10, 20, 0.5)).toBeLessThan(spreadAt(12, 20, 0.5));
    expect(spreadAt(9, 20, 0.5)).toBe(0);
  });

  it("names every backbone a ribbon draws as old or newly laid", () => {
    Arr.forEach([0, 0.06, 0.1, 0.5, 0.93, 1], (share) => {
      Arr.forEach(forkOf(STRETCH, "dna", share), (duplex) => {
        expect(helixOf(duplex.steps).traces).toHaveLength(duplex.fresh.length);
      });
    });
    expect(forkOf(STRETCH, "dna", 1)[0]?.fresh).toStrictEqual([false, true]);
    expect(forkOf(STRETCH, "dna", 1)[1]?.fresh).toStrictEqual([true, false]);
    expect(forkOf(STRETCH, "dna", 0.06)[1]?.fresh).toStrictEqual([false]);
  });

  it("keeps an RNA genome as one ribose strand that gains its partner", () => {
    const genome = basesOf("AUGGCUUACG", "rna");
    const [alone, ...none] = forkOf(genome, "rna", 0);
    expect(none).toHaveLength(0);
    expect(alone?.fresh).toStrictEqual([false]);
    expect(alone?.steps[0]).toMatchObject({
      second: undefined,
      shift: 0,
      sugar: "ribose",
    });
    const [copying, ...rest] = forkOf(genome, "rna", 0.5);
    expect(rest).toHaveLength(0);
    expect(copying?.fresh).toStrictEqual([false, true]);
    expect(Option.getOrUndefined(Arr.last(copying?.steps ?? []))).toMatchObject(
      {
        first: "G",
        second: "C",
        shift: 0,
      }
    );
    expect(helixOf(copying?.steps ?? []).traces).toHaveLength(2);
  });

  it("draws nothing for an empty stretch", () => {
    expect(forkOf([], "dna", 0.5)).toHaveLength(0);
  });
});
