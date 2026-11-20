import type { Point } from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  ARTERIOLE,
  ARTERIOLE_PATH,
  arterioleRadius,
  CAPILLARIES,
  CAPILLARY,
  inner,
  outer,
  VENULE,
  VENULE_PATH,
  venuleRadius,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  arteriolePaint,
  useCutFace,
  venulePaint,
} from "@repo/design-system/components/contents/biology/capillary/section";
import type { Axis } from "@repo/design-system/components/contents/biology/capillary/sweep";
import {
  pointOn,
  useAxis,
  useOrganicMaterial,
  useSweep,
} from "@repo/design-system/components/contents/biology/capillary/sweep";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { BackSide, DoubleSide, Quaternion, Vector3 } from "three";

/** The distance from `angle` to the nearest of `count` seams spread round a tube from `start`, in radians. */
function seamGap(angle: number, start: number, count: number) {
  const spacing = (Math.PI * 2) / count;
  const offset = (((angle - start) % spacing) + spacing) % spacing;
  return Math.min(offset, spacing - offset);
}

/**
 * The endothelium of a vessel `around` cells round and `cell` units long per
 * cell: each cell outlined by a faint cleft where it meets its neighbours,
 * which wanders as real cell borders do, and its nucleus bulging the thin
 * wall into the lumen side. The cells of neighbouring columns are staggered
 * by half a cell.
 */
function endothelium(around: number, cell: number) {
  return (run: number, angle: number, radius: number) => {
    const start = 0.5 + 0.35 * Math.sin(run * 0.8);
    const column = Math.floor(
      ((((angle - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) /
        ((Math.PI * 2) / around)
    );
    const shifted =
      run + (column % 2) * (cell / 2) + 0.25 * Math.sin(angle * 3);
    const inCell = ((shifted % cell) + cell) % cell;
    const across = Math.min(inCell, cell - inCell);
    const along = seamGap(angle, start, around) * radius;
    const border = Math.min(across, along);
    const cleft = border < 0.035 ? 1 - border / 0.035 : 0;
    const centreAngle = start + (column + 0.5) * ((Math.PI * 2) / around);
    const nucleus =
      ((inCell - cell / 2) / (cell * 0.16)) ** 2 +
      ((seamGap(angle, centreAngle, 1) * radius) / 0.17) ** 2;
    const bulge = nucleus < 1 ? Math.sqrt(1 - nucleus) : 0;
    return [
      0.05 * bulge - 0.01 * cleft,
      Math.max(0.55 * cleft, 0.85 * bulge),
    ] as const;
  };
}

/** The capillaries' endothelium: about two cells round a 6 micrometre tube. */
const CAPILLARY_WALL = endothelium(2, 3.2);

/** The venule's endothelium: wider, so more cells round it. */
const VENULE_WALL = endothelium(6, 3.6);

/**
 * The arteriole's outer coat: smooth muscle cells wrapped round it, which a
 * thin adventitia covers, so they show only as fine circumferential
 * striations and the mottling of the cells beneath, never as ridges.
 */
function muscleCoat(run: number, angle: number) {
  const round = Math.cos(angle) * 1.4;
  const side = Math.sin(angle) * 1.4;
  const band = run / 0.6 + 0.9 * valueNoise(run * 0.45 + round, side + 9, 64);
  const striation = Math.sin(Math.PI * (band - Math.floor(band))) ** 2;
  const mottle = valueNoise(run * 0.7 + round, side - 4, 64);
  const swell = valueNoise(run * 0.35 - round, side + 2, 64);
  return [
    0.03 * (swell - 0.5) + 0.006 * striation,
    0.18 * (1 - striation) + 0.45 * mottle,
  ] as const;
}

/** The arteriole's lumen: endothelium over the wavy internal elastic lamina. */
function lumenLining(run: number, angle: number) {
  const wave = Math.sin(angle * 18 + Math.sin(run * 2) * 2);
  return [-0.015 * wave, 0.4 + 0.35 * wave] as const;
}

/** The share of the arteriole's length where the open front of its lumen ends; deeper in, the wall hides it. */
const OPEN = 0.4;

/**
 * The bed's vessels: the muscular arteriole, cut across by the block's front
 * face, narrowing into its last capillary; the capillaries, walls one cell
 * thick that the blood shows through; and the venule, thin-walled and wide,
 * cut by the front face too. A ring of smooth muscle, the precapillary
 * sphincter, guards where each capillary leaves the arteriole.
 */
export function Vessels() {
  const arteriole = useAxis(ARTERIOLE_PATH, arterioleRadius, 420, true);
  const venule = useAxis(VENULE_PATH, venuleRadius, 420, true);
  const muscle = useSweep({
    accent: CAPILLARY_COLORS.muscleDeep,
    axis: arteriole,
    base: CAPILLARY_COLORS.muscle,
    radial: 96,
    shape: muscleCoat,
  });
  const lumen = useSweep({
    accent: CAPILLARY_COLORS.lamina,
    axis: arteriole,
    base: CAPILLARY_COLORS.intima,
    radial: 64,
    scale: inner(ARTERIOLE) / outer(ARTERIOLE),
    shape: lumenLining,
    to: OPEN,
  });
  const vein = useSweep({
    accent: CAPILLARY_COLORS.endotheliumNucleus,
    axis: venule,
    base: CAPILLARY_COLORS.venuleWall,
    radial: 72,
    shape: VENULE_WALL,
  });
  const coat = useOrganicMaterial({
    roughness: 0.55,
    sheen: CAPILLARY_COLORS.lamina,
  });
  const lining = useOrganicMaterial({
    roughness: 0.6,
    sheen: CAPILLARY_COLORS.intima,
    side: BackSide,
  });
  const thin = useOrganicMaterial({
    clearcoat: 0.8,
    opacity: 0.34,
    roughness: 0.3,
    sheen: CAPILLARY_COLORS.endothelium,
  });
  const arterialFace = useCutFace(arteriole, inner(ARTERIOLE), arteriolePaint);
  const venousFace = useCutFace(venule, inner(VENULE), venulePaint, 1);
  const face = useOrganicMaterial({
    clearcoat: 0.1,
    roughness: 0.75,
    sheen: CAPILLARY_COLORS.section,
    side: DoubleSide,
  });

  return (
    <group>
      <mesh castShadow geometry={muscle} material={coat} receiveShadow />
      <mesh geometry={lumen} material={lining} />
      <mesh geometry={arterialFace} material={face} />
      <mesh geometry={vein} material={thin} />
      <mesh geometry={venousFace} material={face} />
      {Arr.map(CAPILLARIES, (capillary, index) => (
        <Capillary
          key={capillary.name}
          path={capillary.path}
          sphincter={index < 4}
        />
      ))}
    </group>
  );
}

/** The capillaries' radius: the same all along. */
function capillaryRadius() {
  return outer(CAPILLARY);
}

/**
 * One capillary: a translucent tube of endothelium, with a precapillary
 * sphincter where it leaves the arteriole.
 */
function Capillary({
  path,
  sphincter,
}: {
  readonly path: readonly Point[];
  readonly sphincter: boolean;
}) {
  const axis = useAxis(
    path,
    capillaryRadius,
    Math.round(path.length * 60),
    true
  );
  const wall = useSweep({
    accent: CAPILLARY_COLORS.endotheliumNucleus,
    axis,
    base: CAPILLARY_COLORS.endothelium,
    radial: 20,
    shape: CAPILLARY_WALL,
  });
  const material = useOrganicMaterial({
    clearcoat: 0.8,
    opacity: 0.28,
    roughness: 0.28,
    sheen: CAPILLARY_COLORS.endothelium,
  });
  const ring = useMemo(() => sphincterPlace(axis), [axis]);
  return (
    <group>
      <mesh geometry={wall} material={material} />
      {sphincter && (
        <mesh position={ring.position} quaternion={ring.turn}>
          <torusGeometry args={[outer(CAPILLARY) + 0.07, 0.07, 10, 36]} />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={CAPILLARY_COLORS.sphincter}
            roughness={0.55}
          />
        </mesh>
      )}
    </group>
  );
}

/** Where the sphincter rings the capillary: just past where it leaves the arteriole's wall. */
function sphincterPlace(axis: Axis) {
  const along = Math.min(1, 0.85 / axis.length);
  const position = pointOn(axis, along, 0, 0, new Vector3());
  const step = Math.round(along * axis.steps) * 3;
  const direction = new Vector3().fromArray(axis.tangent, step);
  return {
    position,
    turn: new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction),
  };
}
