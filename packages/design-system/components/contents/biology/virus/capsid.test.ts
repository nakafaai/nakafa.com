// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  antibodyDomains,
  capsomeres,
  elongate,
  faceNormal,
  helicalSubunits,
  helixPath,
  icosahedronFaces,
  insideBall,
  spoolPath,
  tailFibre,
} from "@repo/design-system/components/contents/biology/virus/capsid";
import { Array as Arr } from "effect";

describe("virus capsid geometry", () => {
  it("builds twenty outward faces on a five-fold axis", () => {
    const faces = icosahedronFaces();

    expect(faces).toHaveLength(20);
    expect(
      Arr.every(faces, (face) => {
        const normal = faceNormal(face);
        const centre = Arr.reduce(face, 0, (sum, corner) => {
          const [x, y, z] = corner;
          return sum + x * normal[0] + y * normal[1] + z * normal[2];
        });
        return centre > 0;
      })
    ).toBe(true);
  });

  it("counts the 252 capsomeres of adenovirus, 12 of them pentons", () => {
    const shell = capsomeres(5);

    expect(shell).toHaveLength(252);
    expect(Arr.filter(shell, ({ kind }) => kind === "penton")).toHaveLength(12);
    expect(
      Arr.every(
        shell,
        ({ normal }) => Math.abs(Math.hypot(...normal) - 1) < 1e-9
      )
    ).toBe(true);
  });

  it("stretches a prolate head along its axis without moving the belt's middle", () => {
    expect(elongate([0.5, 0, 0.2], 0.4)).toEqual([0.5, 0, 0.2]);
    expect(elongate([0, 1, 0], 0.4)[1]).toBeCloseTo(1.4, 12);
    expect(elongate([0, -1, 0], 0.4)[1]).toBeCloseTo(-1.4, 12);
    const head = capsomeres(3, 0.4);
    const tallest = Arr.reduce(head, 0, (top, { position }) =>
      Math.max(top, position[1])
    );
    expect(head).toHaveLength(92);
    expect(tallest).toBeCloseTo(1.4, 9);
  });

  it("winds 16.3 coat proteins a turn along a helical rod", () => {
    const rod = helicalSubunits({ length: 1, perTurn: 16.3, pitch: 0.1 });

    expect(rod).toHaveLength(163);
    const [first, second] = rod;
    expect(first?.x).toBeCloseTo(-0.5, 12);
    expect((second?.angle ?? 0) - (first?.angle ?? 0)).toBeCloseTo(
      (Math.PI * 2) / 16.3,
      12
    );
  });

  it("bends each tail fibre up to a knee and down to its tip", () => {
    const fibre = tailFibre(0, 6);
    const [root, , knee, , tip] = fibre;

    expect(fibre).toHaveLength(5);
    expect(knee[1]).toBeGreaterThan(root[1]);
    expect(tip[1]).toBeLessThan(root[1]);
    expect(Math.hypot(tip[0], tip[2])).toBeGreaterThan(
      Math.hypot(root[0], root[2])
    );
  });

  it("builds an antibody from twelve domains, four of them light chain", () => {
    const domains = antibodyDomains();

    expect(domains).toHaveLength(12);
    expect(Arr.filter(domains, ({ chain }) => chain === "light")).toHaveLength(
      4
    );
  });

  it("keeps packed points inside the virion", () => {
    const points = insideBall(40, 0.8, 3);

    expect(points).toHaveLength(40);
    expect(Arr.every(points, (point) => Math.hypot(...point) < 0.8)).toBe(true);
  });

  it("spools DNA in shells inside the capsid", () => {
    const spool = spoolPath(3, 4, 0.7);

    expect(spool).toHaveLength(3 * 97);
    expect(Arr.every(spool, (point) => Math.hypot(...point) < 0.7)).toBe(true);
  });

  it("winds a strand along a helix from one end to the other", () => {
    const strand = helixPath({ length: 0.4, phase: 0, radius: 0.01, turns: 3 });
    const [start] = strand;

    expect(strand).toHaveLength(49);
    expect(start).toEqual([0.01, -0.2, 0]);
    expect(strand[48]?.[1]).toBeCloseTo(0.2, 12);
  });
});
