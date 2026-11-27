import { useFrame } from "@react-three/fiber";
import { useGlow } from "@repo/design-system/components/three/atom/light";
import {
  breathAt,
  lightNucleon,
  NUCLEON_PROGRAM,
  swellOf,
} from "@repo/design-system/components/three/atom/matter";
import {
  packOf,
  reachOf,
} from "@repo/design-system/components/three/atom/nucleus";
import { facetsOf } from "@repo/design-system/components/three/molecule/ball";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useSurfaceMaps } from "@repo/design-system/components/three/surface/material";
import { getColor } from "@repo/design-system/lib/color";
import { PARTICLE_COLORS } from "@repo/design-system/lib/material/particle";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh, Material, Sprite } from "three";
import {
  AdditiveBlending,
  Color,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

/** How much wider than the nucleus its glow is drawn, and how bright that glow is at rest. */
const AURA = 5.6;
const GLOW = 0.55;

/** How strongly the grain of a nucleon's surface bends the light. */
const GRAIN = 0.45;

/** Lays the nucleon's program on the material it is given. */
function lay(material: Material | null) {
  if (material === null) {
    return;
  }
  material.onBeforeCompile = lightNucleon;
  material.customProgramCacheKey = () => NUCLEON_PROGRAM;
  material.needsUpdate = true;
}

/**
 * An atomic nucleus as what it is: `protons` and `neutrons` packed into a
 * ball, red protons mixed evenly among grey neutrons, each pressed a little
 * into its neighbours. A nucleon cannot be photographed, so none is drawn as
 * a painted ball: each is soft, matte matter with a grainy glow from within
 * and light along its rim, and the whole nucleus breathes inside the glow
 * of the energy that binds it. `nucleon` is the radius of one nucleon in
 * scene units, so a heavier nucleus is a larger ball, as in nature. All
 * nucleons are one instanced mesh, their detail follows the stage's tier,
 * and nothing is allocated while the glow breathes.
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
  const aura = useRef<Sprite>(null);
  const nucleons = useMemo(
    () => packOf(protons, neutrons),
    [neutrons, protons]
  );
  const geometry = useMemo(() => {
    const facets = facetsOf(tier);
    return new SphereGeometry(1, facets.sides, facets.rings);
  }, [tier]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const maps = useSurfaceMaps("concrete", 2, 1);
  const reach = reachOf(nucleons) * nucleon;

  useFrame((state) => {
    const sprite = aura.current;
    if (sprite === null) {
      return;
    }
    const breath = breathAt(state.clock.elapsedTime);
    sprite.scale.setScalar(reach * AURA * breath.size);
    sprite.material.opacity = GLOW * breath.glow;
  });

  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const axis = new Vector3();
    const place = new Vector3();
    const size = new Vector3();
    const color = new Color();
    Arr.forEach(nucleons, (packed, index) => {
      axis.set(Math.sin(index * 1.7), Math.cos(index * 2.9), Math.sin(index));
      turn.setFromAxisAngle(axis.normalize(), index * 2.4);
      matrix.compose(
        place.set(...packed.at),
        turn,
        size.setScalar(swellOf(index))
      );
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
        <meshStandardMaterial
          color={getColor("WHITE")}
          emissive={getColor("WHITE")}
          envMapIntensity={0.25}
          map={maps.tone}
          normalMap={maps.normal}
          normalScale={[GRAIN, GRAIN]}
          ref={lay}
          roughness={1}
        />
      </instancedMesh>
      <sprite ref={aura} scale={reach * AURA}>
        <spriteMaterial
          blending={AdditiveBlending}
          color={PARTICLE_COLORS.bindingGlow}
          depthWrite={false}
          map={glow}
          opacity={GLOW}
          toneMapped={false}
          transparent
        />
      </sprite>
    </group>
  );
}
