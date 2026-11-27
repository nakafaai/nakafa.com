import { useGlow } from "@repo/design-system/components/three/atom/light";
import {
  packOf,
  reachOf,
} from "@repo/design-system/components/three/atom/nucleus";
import { facetsOf } from "@repo/design-system/components/three/molecule/ball";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { PARTICLE_COLORS } from "@repo/design-system/lib/material/particle";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  AdditiveBlending,
  Color,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

/** How much wider than the nucleus its glow is drawn. */
const AURA = 5.2;

/**
 * An atomic nucleus as what it is: `protons` and `neutrons` packed as
 * touching spheres into a ball, red protons mixed evenly among grey
 * neutrons, each with the fine relief of a real surface so light falls off
 * round it and the cluster has depth, and the faint glow of the energy that
 * binds it. `nucleon` is the radius of one nucleon in scene units, so a
 * heavier nucleus is a larger ball, as in nature. All nucleons are one
 * instanced mesh, and their detail follows the stage's tier.
 */
export function AtomNucleus({
  neutrons,
  nucleon,
  protons,
}: {
  readonly neutrons: number;
  readonly nucleon: number;
  readonly protons: number;
}) {
  const { tier } = useStage();
  const glow = useGlow();
  const mesh = useRef<InstancedMesh>(null);
  const nucleons = useMemo(
    () => packOf(protons, neutrons),
    [neutrons, protons]
  );
  const geometry = useMemo(() => {
    const facets = facetsOf(tier);
    return new SphereGeometry(1, facets.sides, facets.rings);
  }, [tier]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const axis = new Vector3();
    const place = new Vector3();
    const size = new Vector3(1, 1, 1);
    const color = new Color();
    Arr.forEach(nucleons, (packed, index) => {
      axis.set(Math.sin(index * 1.7), Math.cos(index * 2.9), Math.sin(index));
      turn.setFromAxisAngle(axis.normalize(), index * 2.4);
      matrix.compose(place.set(...packed.at), turn, size);
      target.setMatrixAt(index, matrix);
      target.setColorAt(
        index,
        color.set(
          packed.kind === "proton"
            ? PARTICLE_COLORS.proton
            : PARTICLE_COLORS.neutron
        )
      );
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  }, [nucleons]);

  if (nucleons.length === 0) {
    return null;
  }
  return (
    <group>
      <instancedMesh
        args={[geometry, undefined, nucleons.length]}
        castShadow
        key={nucleons.length}
        receiveShadow
        ref={mesh}
        scale={nucleon}
      >
        <SurfaceMaterial
          bump={0.5}
          coat={0.35}
          color={getColor("WHITE")}
          repeat={[2, 1]}
          roughness={0.55}
          surface="rubber"
        />
      </instancedMesh>
      <sprite scale={reachOf(nucleons) * nucleon * AURA}>
        <spriteMaterial
          blending={AdditiveBlending}
          color={PARTICLE_COLORS.bindingGlow}
          depthWrite={false}
          map={glow}
          opacity={0.5}
          toneMapped={false}
          transparent
        />
      </sprite>
    </group>
  );
}
