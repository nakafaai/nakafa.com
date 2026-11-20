import { useFrame } from "@react-three/fiber";
import type { Hill } from "@repo/design-system/components/contents/biology/paddy/field";
import {
  hillMatrix,
  rootedHills,
} from "@repo/design-system/components/contents/biology/paddy/field";
import type { Plant } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { channelOxygen } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import { rootPaths } from "@repo/design-system/components/contents/biology/paddy/roots";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr, Order } from "effect";
import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from "three";

/** How many of the nearest rooted plants carry dots. */
const CARRIERS = 3;

/** How many roots of each plant carry dots, and how many dots ride each. */
const ROOTS_EACH = 5;
const DOTS_EACH = 3;

/** Seconds a dot takes from the base of its root to the tip. */
const PERIOD = 6;

/** A dot's radius in metres: drawn larger than an oxygen molecule so the eye can follow it. */
const DOT = 0.0032;

/**
 * Oxygen moving down the roots of the nearest plants, from the shoot to the tip, as far
 * as the root's air channels carry it, and out into the mud at the tip of a
 * flooded rice root. Each dot shows only where the model leaves oxygen in
 * the channel, so in maize they stop within a few centimetres of the base.
 */
export function RootFlow({
  clock,
  flood,
  plant,
}: {
  readonly clock: RefObject<number>;
  readonly flood: RefObject<number>;
  readonly plant: Plant;
}) {
  const dots = useRef<InstancedMesh>(null);
  const routes = useMemo(() => {
    const nearest = Arr.take(
      Arr.sort(
        rootedHills(plant),
        Order.mapInput(Order.Number, (hill: Hill) => Math.abs(hill.x) - hill.z)
      ),
      CARRIERS
    );
    const paths = Arr.take(
      Arr.filter(rootPaths(plant), (path) => !path.shallow),
      ROOTS_EACH
    );
    return Arr.flatMap(nearest, (hill) => {
      const place = hillMatrix(hill);
      return Arr.map(
        paths,
        (path) =>
          new CatmullRomCurve3(
            Arr.map(path.points, (point) => point.clone().applyMatrix4(place))
          )
      );
    });
  }, [plant]);
  const scratch = useMemo(
    () => ({
      matrix: new Matrix4(),
      point: new Vector3(),
      scale: new Vector3(),
      tangent: new Vector3(),
      turn: new Quaternion(),
    }),
    []
  );

  useFrame(() => {
    const mesh = dots.current;
    if (mesh === null) {
      return;
    }
    Arr.forEach(routes, (route, carrier) => {
      Arr.forEach(Arr.range(0, DOTS_EACH - 1), (dot) => {
        const slot = carrier * DOTS_EACH + dot;
        const travel =
          (clock.current / PERIOD + dot / DOTS_EACH + hashUnit(carrier, 61)) %
          1;
        const along = Math.min(1, travel / 0.85);
        route.getPointAt(along, scratch.point);
        const leak = Math.max(0, (travel - 0.85) / 0.15);
        route.getTangentAt(1, scratch.tangent);
        scratch.point.addScaledVector(
          scratch.tangent,
          leak * 0.012 * flood.current
        );
        const carried = channelOxygen(plant, -scratch.point.y) > 0.02 ? 1 : 0;
        const fade = leak > 0 ? (1 - leak) * flood.current : 1;
        mesh.setMatrixAt(
          slot,
          scratch.matrix.compose(
            scratch.point,
            scratch.turn,
            scratch.scale.setScalar(Math.max(1e-4, DOT * carried * fade))
          )
        );
      });
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      args={[undefined, undefined, routes.length * DOTS_EACH]}
      ref={dots}
    >
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial
        color={PADDY_COLORS.oxygen}
        emissive={PADDY_COLORS.oxygen}
        emissiveIntensity={0.45}
        roughness={0.3}
      />
    </instancedMesh>
  );
}
