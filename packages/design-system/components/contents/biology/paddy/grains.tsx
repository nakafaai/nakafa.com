import { useFrame } from "@react-three/fiber";
import { ROOT_DEPTH } from "@repo/design-system/components/contents/biology/paddy/oxygen";
import {
  buryInSoil,
  XRAY,
  xrayUniforms,
} from "@repo/design-system/components/contents/biology/paddy/xray";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { PADDY_COLORS } from "@repo/design-system/lib/material/paddy";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  Color,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

/** How many specks the X-ray soil shows, and how far round the zone they lie, in metres. */
const SPECKS = { count: 2600, reach: 0.95 } as const;

/** How deep the specks reach, in metres: through the plough layer into the subsoil. */
const DEEPEST = ROOT_DEPTH + 0.12;

/**
 * What one speck of soil is, by a hash in [0, 1): a dark fleck of rotting
 * straw and roots, a pale grain of sand, or below the plough pan a rusty
 * mottle of iron oxide, the mottled subsoil of a paddy (Ponnamperuma 1972).
 */
function speckColor(kind: number, depth: number) {
  if (depth > ROOT_DEPTH + 0.02 && kind > 0.7) {
    return PADDY_COLORS.mottle;
  }
  return kind < 0.6 ? PADDY_COLORS.organic : PADDY_COLORS.sand;
}

/** Where each speck lies, how it is turned and squashed, and its colour. */
function specks() {
  return Arr.map(Arr.range(0, SPECKS.count - 1), (index) => {
    const angle = hashUnit(index, 71) * Math.PI * 2;
    const out = Math.sqrt(hashUnit(index, 72)) * SPECKS.reach;
    const depth = 0.004 + hashUnit(index, 73) * DEEPEST;
    const size = 0.0007 + 0.0024 * hashUnit(index, 74) ** 2;
    return {
      color: speckColor(hashUnit(index, 75), depth),
      matrix: new Matrix4().compose(
        new Vector3(
          XRAY.zone[0] + Math.cos(angle) * out,
          -depth,
          XRAY.zone[1] + Math.sin(angle) * out
        ),
        new Quaternion().setFromEuler(
          new Euler(
            hashUnit(index, 76) * Math.PI,
            hashUnit(index, 77) * Math.PI,
            0
          )
        ),
        new Vector3(size, size * (0.5 + 0.4 * hashUnit(index, 78)), size)
      ),
    };
  });
}

/**
 * The grains and flecks in the soil the X-ray view looks through: bits of
 * old straw and roots, sand grains, and rusty iron mottles in the subsoil,
 * each dimmed by the soil above it like the roots, so the mud reads as mud.
 */
export function SoilGrains({ flood }: { readonly flood: RefObject<number> }) {
  const mesh = useRef<InstancedMesh>(null);
  const { geometry, material, uniforms } = useMemo(() => {
    const shared = xrayUniforms();
    const speck = new MeshStandardMaterial({ metalness: 0, roughness: 0.9 });
    buryInSoil(speck, shared, "grain");
    return {
      geometry: new IcosahedronGeometry(1, 0),
      material: speck,
      uniforms: shared,
    };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const tone = new Color();
    Arr.forEach(specks(), ({ color, matrix }, index) => {
      target.setMatrixAt(index, matrix);
      target.setColorAt(index, tone.set(color));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) {
      target.instanceColor.needsUpdate = true;
    }
    target.computeBoundingSphere();
  }, []);

  useFrame(() => {
    uniforms.uFlood.value = flood.current;
  });

  return <instancedMesh args={[geometry, material, SPECKS.count]} ref={mesh} />;
}
