import {
  BLOCK,
  FLOOR,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { useOrganicMaterial } from "@repo/design-system/components/contents/biology/capillary/sweep";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { BufferAttribute, Color, DoubleSide, PlaneGeometry } from "three";

/** How finely the floor is drawn, in vertices a scene unit. */
const DENSITY = 14;

/** The width and depth of the block, in scene units. */
const WIDTH = BLOCK.right - BLOCK.left;
const DEPTH = BLOCK.front - BLOCK.back;

/** Where a wavy band of collagen runs across the floor, from 0 between bundles to 1 on one. */
function collagen(x: number, z: number) {
  const family = (angle: number, seed: number) => {
    const along = x * Math.cos(angle) + z * Math.sin(angle);
    const across = z * Math.cos(angle) - x * Math.sin(angle);
    const warp = valueNoise(along * 0.22 + seed, across * 0.5, 64) * 7;
    const line = Math.sin(across * 2.6 + warp);
    const patch = valueNoise(x * 0.18 + seed * 3, z * 0.18 - seed, 64);
    return (
      Math.max(0, (line - 0.86) / 0.14) *
      Math.min(1, Math.max(0, (patch - 0.35) / 0.4))
    );
  };
  return Math.min(
    1,
    Math.max(family(0.35, 1), family(1.6, 5), 0.8 * family(2.6, 9))
  );
}

/**
 * The cut top of the connective tissue the vessels rest on: ground substance
 * with wavy bundles of collagen standing a little proud of it, mottled where
 * the matrix is denser. The bumps fade to nothing at the block's edges, so the
 * top meets the cut faces cleanly.
 */
function useFloorTop() {
  const geometry = useMemo(() => {
    const top = new PlaneGeometry(
      WIDTH,
      DEPTH,
      WIDTH * DENSITY,
      DEPTH * DENSITY
    );
    top.rotateX(-Math.PI / 2);
    top.translate(
      (BLOCK.left + BLOCK.right) / 2,
      0,
      (BLOCK.back + BLOCK.front) / 2
    );
    const position = top.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const ground = new Color(CAPILLARY_COLORS.ground);
    const deep = new Color(CAPILLARY_COLORS.groundDeep);
    const fibre = new Color(CAPILLARY_COLORS.collagen);
    const color = new Color();
    for (const index of Arr.range(0, position.count - 1)) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const edge = Math.min(
        1,
        Math.min(
          x - BLOCK.left,
          BLOCK.right - x,
          z - BLOCK.back,
          BLOCK.front - z
        ) / 0.3
      );
      const band = collagen(x, z);
      const mottle = valueNoise(x * 0.9, z * 0.9 + 3, 64);
      const speck = valueNoise(x * 4, z * 4, 64) - 0.5;
      position.setY(index, edge * (0.035 * band + 0.012 * speck));
      color
        .copy(ground)
        .lerp(deep, 0.55 * mottle)
        .lerp(fibre, 0.75 * band);
      color.toArray(colors, index * 3);
    }
    top.setAttribute("color", new BufferAttribute(colors, 3));
    top.computeVertexNormals();
    return top;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The colour of the block's cut face at a point `u` along it and `v` down it: a stained section of connective tissue. */
function sectionPaint(
  u: number,
  v: number,
  seed: number,
  into: Color,
  palette: ReturnType<typeof useSectionPalette>
) {
  const streak = Math.sin(v * 9 + valueNoise(u * 0.8 + seed, v * 0.8, 64) * 5);
  into.copy(palette.section).lerp(palette.fibre, Math.max(0, streak) * 0.55);
  const column = Math.floor(u / 0.55);
  const row = Math.floor(v / 0.55);
  const cx = (column + 0.25 + 0.5 * hashUnit(column + seed, row)) * 0.55;
  const cy = (row + 0.25 + 0.5 * hashUnit(row + seed, column + 5)) * 0.55;
  const size = 0.08 + 0.05 * hashUnit(column, row + seed);
  const inside = ((u - cx) / (size * 1.6)) ** 2 + ((v - cy) / size) ** 2 < 1;
  return inside && hashUnit(column + 3, row + seed) < 0.4
    ? into.copy(palette.nucleus)
    : into;
}

/** The section colours, made once. */
function useSectionPalette() {
  return useMemo(
    () => ({
      fibre: new Color(CAPILLARY_COLORS.sectionFibre),
      nucleus: new Color(CAPILLARY_COLORS.sectionNucleus),
      section: new Color(CAPILLARY_COLORS.section),
    }),
    []
  );
}

/** The four cut faces of the block below the floor's top, each painted as a stained section. */
function useCutSides() {
  const palette = useSectionPalette();
  const geometry = useMemo(() => {
    const color = new Color();
    const faces = [
      {
        length: WIDTH,
        seed: 1,
        place: (u: number) => [BLOCK.left + u, BLOCK.front] as const,
        turn: 0,
      },
      {
        length: DEPTH,
        seed: 2,
        place: (u: number) => [BLOCK.right, BLOCK.front - u] as const,
        turn: Math.PI / 2,
      },
      {
        length: WIDTH,
        seed: 3,
        place: (u: number) => [BLOCK.right - u, BLOCK.back] as const,
        turn: Math.PI,
      },
      {
        length: DEPTH,
        seed: 4,
        place: (u: number) => [BLOCK.left, BLOCK.back + u] as const,
        turn: -Math.PI / 2,
      },
    ];
    const pieces = Arr.map(faces, (face) => {
      const plane = new PlaneGeometry(
        face.length,
        FLOOR,
        Math.round(face.length * 22),
        Math.round(FLOOR * 22)
      );
      const position = plane.getAttribute("position");
      const colors = new Float32Array(position.count * 3);
      for (const index of Arr.range(0, position.count - 1)) {
        const u = position.getX(index) + face.length / 2;
        const v = FLOOR / 2 - position.getY(index);
        sectionPaint(u, v, face.seed, color, palette).toArray(
          colors,
          index * 3
        );
      }
      plane.setAttribute("color", new BufferAttribute(colors, 3));
      plane.rotateY(face.turn);
      const [x, z] = face.place(face.length / 2);
      plane.translate(x, -FLOOR / 2, z);
      return plane;
    });
    return pieces;
  }, [palette]);
  useEffect(
    () => () => Arr.forEach(geometry, (piece) => piece.dispose()),
    [geometry]
  );
  return geometry;
}

/**
 * The block of connective tissue the bed lies in: its cut top, on which the
 * vessels and the tissue cells rest, and its cut faces, stained as a section.
 */
export function Floor() {
  const top = useFloorTop();
  const sides = useCutSides();
  const surface = useOrganicMaterial({
    clearcoat: 0.25,
    roughness: 0.62,
    sheen: CAPILLARY_COLORS.collagen,
  });
  const section = useOrganicMaterial({
    clearcoat: 0.08,
    roughness: 0.8,
    sheen: CAPILLARY_COLORS.section,
    side: DoubleSide,
  });
  return (
    <group>
      <mesh geometry={top} material={surface} receiveShadow />
      {Arr.map(sides, (side) => (
        <mesh geometry={side} key={side.uuid} material={section} />
      ))}
    </group>
  );
}
