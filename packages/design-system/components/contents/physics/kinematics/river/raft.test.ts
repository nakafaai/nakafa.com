import { describe, expect, it } from "@effect/vitest";
import {
  hyacinthRaft,
  raftAlong,
  raftLanes,
  raftShown,
} from "@repo/design-system/components/contents/physics/kinematics/river/raft";
import { Array as Arr } from "effect";

describe("hyacinthRaft", () => {
  const raft = hyacinthRaft();
  const count = raft.positions.length / 3;

  it("is whole triangles over its own vertices, one shade for each", () => {
    expect(raft.shades.length).toBe(count);
    expect(raft.indices.length % 3).toBe(0);
    expect(Math.max(...raft.indices)).toBe(count - 1);
    expect(Math.min(...raft.indices)).toBe(0);
  });

  it("floats on the water about two metres across with leaves a hand above it", () => {
    const heights = Arr.filter(raft.positions, (_, index) => index % 3 === 1);
    const across = Arr.filter(raft.positions, (_, index) => index % 3 === 0);
    expect(Math.min(...heights)).toBeCloseTo(-0.02, 9);
    expect(Math.max(...heights)).toBeLessThan(0.4);
    expect(Math.max(...across) - Math.min(...across)).toBeGreaterThan(1.2);
    expect(Math.max(...across) - Math.min(...across)).toBeLessThan(2.6);
  });

  it("is pale at the foot of a stalk and green on a blade", () => {
    expect(raft.shades[0]).toBe(0);
    expect(Math.max(...raft.shades)).toBe(1);
  });
});

describe("raftLanes", () => {
  it("keeps every raft clear of both banks", () => {
    const lanes = raftLanes(60, 40);
    expect(lanes.length).toBe(40);
    expect(
      Math.max(...Arr.map(lanes, (lane) => Math.abs(lane.z)))
    ).toBeLessThan(27);
    expect(Math.min(...Arr.map(lanes, (lane) => lane.scale))).toBeGreaterThan(
      0.59
    );
  });
});

describe("raftAlong", () => {
  it("rides the current downstream at the water's own speed", () => {
    expect(raftAlong(0.5, 2, 3, 60) - raftAlong(0.5, 0, 3, 60)).toBeCloseTo(
      6,
      9
    );
    expect(raftAlong(0.5, 9, 0, 60)).toBeCloseTo(raftAlong(0.5, 0, 0, 60), 9);
  });

  it("starts again upstream once it has drifted the whole reach", () => {
    expect(raftAlong(0, 0, 3, 60)).toBeCloseTo(-144, 9);
    expect(raftAlong(0.25, 120, 3, 60)).toBeCloseTo(-54, 9);
  });
});

describe("raftShown", () => {
  it("grows in upstream, shows whole in view, and sinks away at the far end", () => {
    expect(raftShown(-144, 60)).toBeCloseTo(0, 9);
    expect(raftShown(0, 60)).toBe(1);
    expect(raftShown(216, 60)).toBeCloseTo(0, 9);
    expect(raftShown(-135, 60)).toBeCloseTo(0.5, 9);
  });
});
