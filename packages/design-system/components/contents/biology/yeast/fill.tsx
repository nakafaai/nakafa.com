import { useFrame } from "@react-three/fiber";
import {
  flowShare,
  gasFlow,
  SETUP,
} from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  FINE,
  fineRiseSpeed,
  fizzCount,
} from "@repo/design-system/components/contents/biology/yeast/limewater";
import { useRun } from "@repo/design-system/components/contents/biology/yeast/run";
import type { Tube } from "@repo/design-system/components/contents/biology/yeast/tube";
import {
  BOILING_TUBE,
  innerRadius,
  levelOf,
} from "@repo/design-system/components/contents/biology/yeast/tube";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { LiquidMaterial } from "@repo/design-system/components/three/physical";
import { YEAST_COLORS } from "@repo/design-system/lib/material/yeast";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group, InstancedMesh, Mesh } from "three";
import { LatheGeometry, Object3D, Vector2 } from "three";

/** How far a liquid stands in from the glass it fills, so the two never share a surface, in metres. */
export const GAP = 0.0003;

/** How high water climbs a glass wall in its meniscus, and how far in it curves, in metres. */
const MENISCUS = { reach: 0.0035, rise: 0.0012 } as const;

/**
 * The outline of the liquid between `from` and `to` millilitres in a tube,
 * turned about its axis: it follows the round foot when it starts there,
 * climbs the wall, and curves into a meniscus at its surface; under a layer
 * of oil (`covered`) its surface lies flat. A layer that floats on another
 * has no floor of its own, so the two share no face.
 */
function columnOutline(tube: Tube, from: number, to: number, covered: boolean) {
  const radius = innerRadius(tube) - GAP;
  const centre = tube.diameter / 2;
  const top = tube.wall + levelOf(tube, to);
  const bottom = tube.wall + levelOf(tube, from);
  const floor =
    from > 0
      ? [new Vector2(radius, bottom)]
      : Arr.filter(
          Arr.map(Arr.range(0, 12), (step) => {
            const angle = (step / 12) * (Math.PI / 2);
            return new Vector2(
              Math.max(1e-5, radius * Math.sin(angle)),
              centre - radius * Math.cos(angle)
            );
          }),
          (point) => point.y < top
        );
  const rise = covered ? 0 : MENISCUS.rise;
  const surface = Arr.map(Arr.range(0, 6), (step) => {
    const share = step / 6;
    return new Vector2(
      radius - share * MENISCUS.reach,
      top + rise * (1 - share) ** 2
    );
  });
  return [...floor, ...surface, new Vector2(1e-5, top)];
}

/** The liquid between `from` and `to` millilitres of a tube, as one turned solid. */
function useColumn(tube: Tube, from: number, to: number, covered = false) {
  const geometry = useMemo(
    () => new LatheGeometry(columnOutline(tube, from, to, covered), 48),
    [covered, from, to, tube]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The suspension and the glucose solution of the yeast tube, in millilitres. */
const MIXTURE = SETUP.glucose + SETUP.suspension;

/** How thick the froth stands on the suspension when gas leaves at its fastest, drawn at 4 mm. */
const FROTH = 0.004;

/** The fine bubbles a tube can show at once, and the froth's bubbles. */
const FIZZ_POOL = 24;
const FROTH_POOL = 70;

/**
 * The yeast tube's contents: the milky tan suspension, fine bubbles of
 * carbon dioxide rising against the glass, the froth that gathers on top and
 * lifts the paraffin oil, all as fast as the yeast lets gas out.
 */
export function YeastFill() {
  const run = useRun();
  const suspension = useColumn(BOILING_TUBE, 0, MIXTURE, true);
  const oil = useColumn(BOILING_TUBE, MIXTURE, MIXTURE + SETUP.oil);
  const lift = useRef<Group>(null);
  const froth = useRef<Mesh>(null);
  const foam = useRef<InstancedMesh>(null);
  const fizz = useRef<InstancedMesh>(null);
  const holder = useMemo(() => new Object3D(), []);
  const radius = innerRadius(BOILING_TUBE) - GAP;
  const surface = BOILING_TUBE.wall + levelOf(BOILING_TUBE, MIXTURE);
  const floor = BOILING_TUBE.diameter / 2;
  const rise = fineRiseSpeed(FINE);

  useFrame(() => {
    const minutes = run.clock.current;
    const share = flowShare(run.celsius, run.percent, minutes);
    const depth = FROTH * share;
    lift.current?.position.set(0, depth, 0);
    froth.current?.scale.set(1, Math.max(depth, 1e-5), 1);
    froth.current?.position.set(0, surface + depth / 2, 0);
    const bubbles = foam.current;
    if (bubbles !== null) {
      bubbles.count = share > 0 ? FROTH_POOL : 0;
      Arr.forEach(Arr.range(0, FROTH_POOL - 1), (index) => {
        const turn = hashUnit(index, 3) * Math.PI * 2;
        const size = Math.min(0.0005 + 0.0006 * hashUnit(index, 7), depth / 2);
        const out = radius - size - 0.0008 * hashUnit(index, 5);
        holder.position.set(
          Math.sin(turn) * out,
          surface + size + (depth - 2 * size) * hashUnit(index, 11),
          Math.cos(turn) * out
        );
        holder.scale.setScalar(Math.max(size, 1e-5));
        holder.updateMatrix();
        bubbles.setMatrixAt(index, holder.matrix);
      });
      bubbles.instanceMatrix.needsUpdate = true;
    }
    const fine = fizz.current;
    if (fine === null) {
      return;
    }
    const flow = gasFlow(run.celsius, run.percent, minutes);
    const shown = Math.min(
      FIZZ_POOL,
      Math.round(fizzCount(flow, surface - floor, radius))
    );
    fine.count = shown;
    const column = surface - floor - FINE;
    Arr.forEach(Arr.range(0, shown - 1), (index) => {
      const turn = (hashUnit(index, 13) - 0.5) * Math.PI * 1.6;
      const climb =
        (hashUnit(index, 17) + (run.seconds.current * rise) / column) % 1;
      holder.position.set(
        Math.sin(turn) * (radius - FINE / 3),
        floor + climb * column,
        Math.cos(turn) * (radius - FINE / 3)
      );
      holder.scale.setScalar(FINE / 2);
      holder.updateMatrix();
      fine.setMatrixAt(index, holder.matrix);
    });
    fine.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <mesh geometry={suspension}>
        <meshPhysicalMaterial
          clearcoat={0.4}
          clearcoatRoughness={0.25}
          color={YEAST_COLORS.suspension}
          roughness={0.42}
        />
      </mesh>
      <mesh ref={froth}>
        <cylinderGeometry args={[radius - 0.0002, radius - 0.0002, 1, 40]} />
        <meshStandardMaterial color={YEAST_COLORS.froth} roughness={0.85} />
      </mesh>
      <instancedMesh args={[undefined, undefined, FROTH_POOL]} ref={foam}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.1}
          color={YEAST_COLORS.froth}
          roughness={0.2}
        />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, FIZZ_POOL]} ref={fizz}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.05}
          color={YEAST_COLORS.froth}
          roughness={0.1}
        />
      </instancedMesh>
      <group ref={lift}>
        <mesh geometry={oil} renderOrder={1}>
          <LiquidMaterial color={YEAST_COLORS.paraffin} opacity={0.55} />
        </mesh>
      </group>
    </group>
  );
}

/** The control tube's contents: clear glucose solution under its layer of oil. */
export function ControlFill() {
  const glucose = useColumn(BOILING_TUBE, 0, SETUP.glucose, true);
  const oil = useColumn(BOILING_TUBE, SETUP.glucose, SETUP.glucose + SETUP.oil);
  return (
    <group>
      <mesh geometry={glucose} renderOrder={1}>
        <LiquidMaterial color={YEAST_COLORS.glucose} opacity={0.2} />
      </mesh>
      <mesh geometry={oil} renderOrder={1}>
        <LiquidMaterial color={YEAST_COLORS.paraffin} opacity={0.55} />
      </mesh>
    </group>
  );
}

/** The outline of a tube's limewater, for the limewater part to draw. */
export function useLimewater(tube: Tube, volume: number) {
  return useColumn(tube, 0, volume);
}
