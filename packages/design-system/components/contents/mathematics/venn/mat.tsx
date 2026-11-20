import {
  HOOP,
  letterPlaces,
  MAT,
  type Place,
  TRAY,
  TRAY_Z,
  UNIVERSE_PLACE,
} from "@repo/design-system/components/contents/mathematics/venn/layout";
import type { VennOperation } from "@repo/design-system/components/contents/mathematics/venn/sets";
import {
  TINT_DEPTH,
  TINT_WIDTH,
  tintImage,
} from "@repo/design-system/components/contents/mathematics/venn/tint";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { VENN_COLORS } from "@repo/design-system/lib/material/venn";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { DataTexture, LinearFilter, RGBAFormat } from "three";

/** The hoops' colours, A first. */
export const HOOP_COLORS = [
  VENN_COLORS.hoopA,
  VENN_COLORS.hoopB,
  VENN_COLORS.hoopC,
] as const;

/** The letters of the sets, A first. */
export const LETTERS = ["A", "B", "C"] as const;

/** The top of the mat, where the hoops and the objects lie. */
export const MAT_TOP = MAT.thickness;

/** The cotton tape bound round the mat's edge, 3 cm wide. */
const BINDING = 0.03;

/** The thickness of the tray's floor, where waiting objects stand. */
export const TRAY_FLOOR = 0.01;

/**
 * The canvas activity mat, the universal set: its weave at real size, a
 * grey tape bound round its edge, and the symbol of the universal set
 * printed in its back corner in the tape's grey, which reads on the light
 * canvas in either theme.
 */
export function Mat() {
  const edges = [
    { at: [0, -MAT.depth / 2 + BINDING / 2], size: [MAT.width, BINDING] },
    { at: [0, MAT.depth / 2 - BINDING / 2], size: [MAT.width, BINDING] },
    { at: [-MAT.width / 2 + BINDING / 2, 0], size: [BINDING, MAT.depth] },
    { at: [MAT.width / 2 - BINDING / 2, 0], size: [BINDING, MAT.depth] },
  ] as const;
  return (
    <group>
      <mesh position={[0, MAT.thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[MAT.width, MAT.thickness, MAT.depth]} />
        <SurfaceMaterial
          bump={0.3}
          color={VENN_COLORS.mat}
          repeat={[MAT.width / 0.19, MAT.depth / 0.19]}
          roughness={0.95}
          surface="cloth"
        />
      </mesh>
      {Arr.map(edges, (edge) => (
        <mesh
          key={`${edge.at[0]}-${edge.at[1]}`}
          position={[edge.at[0], MAT.thickness + 0.0004, edge.at[1]]}
          receiveShadow
        >
          <boxGeometry args={[edge.size[0], 0.0008, edge.size[1]]} />
          <meshStandardMaterial color={VENN_COLORS.binding} roughness={0.9} />
        </mesh>
      ))}
      <ThreeLabel
        color={VENN_COLORS.binding}
        fontSize="annotation"
        outlineColor={VENN_COLORS.mat}
        outlineWidth={0.004}
        position={[UNIVERSE_PLACE.x, MAT_TOP, UNIVERSE_PLACE.z]}
      >
        <InlineMath math="\xi" />
      </ThreeLabel>
    </group>
  );
}

/**
 * The plastic hula hoops lying on the mat, each with its letter printed on
 * the mat just outside it, in the hoop's colour. The card names what each
 * hoop gathers, where the words never crowd the mat.
 */
export function Hoops({ centres }: { readonly centres: readonly Place[] }) {
  const letters = letterPlaces(centres);
  return (
    <group>
      {Arr.map(centres, (centre, index) => {
        const color = HOOP_COLORS[index] ?? VENN_COLORS.hoopA;
        const letter = letters[index] ?? centre;
        return (
          <group key={LETTERS[index]}>
            <mesh
              castShadow
              position={[
                centre.x,
                MAT_TOP + HOOP.tube + index * 0.0002,
                centre.z,
              ]}
              receiveShadow
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[HOOP.radius, HOOP.tube, 16, 160]} />
              <meshPhysicalMaterial
                clearcoat={1}
                clearcoatRoughness={0.12}
                color={color}
                roughness={0.32}
              />
            </mesh>
            <ThreeLabel
              color={color}
              fontSize="annotation"
              outlineColor={VENN_COLORS.mat}
              outlineWidth={0.004}
              position={[letter.x, MAT_TOP, letter.z]}
            >
              {LETTERS[index]}
            </ThreeLabel>
          </group>
        );
      })}
    </group>
  );
}

/** The tint over the region the chosen operation selects, lying just above the mat's weave. */
export function RegionTint({
  centres,
  operation,
}: {
  readonly centres: readonly Place[];
  readonly operation: VennOperation;
}) {
  const texture = useMemo(() => {
    const image = new DataTexture(
      tintImage(operation, centres),
      TINT_WIDTH,
      TINT_DEPTH,
      RGBAFormat
    );
    image.magFilter = LinearFilter;
    image.minFilter = LinearFilter;
    image.needsUpdate = true;
    return image;
  }, [centres, operation]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, MAT_TOP + 0.0009, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry
        args={[MAT.width - 2 * BINDING, MAT.depth - 2 * BINDING]}
      />
      <meshBasicMaterial
        alphaMap={texture}
        color={VENN_COLORS.region}
        depthWrite={false}
        opacity={0.42}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}

/** The oiled beech tray the objects wait on, in front of the mat. */
export function Tray() {
  const outer = {
    depth: TRAY.depth + 2 * TRAY.rim,
    width: TRAY.width + 2 * TRAY.rim,
  };
  const rims = [
    { at: [0, -outer.depth / 2 + TRAY.rim / 2], size: [outer.width, TRAY.rim] },
    { at: [0, outer.depth / 2 - TRAY.rim / 2], size: [outer.width, TRAY.rim] },
    { at: [-outer.width / 2 + TRAY.rim / 2, 0], size: [TRAY.rim, TRAY.depth] },
    { at: [outer.width / 2 - TRAY.rim / 2, 0], size: [TRAY.rim, TRAY.depth] },
  ] as const;
  return (
    <group position={[0, 0, TRAY_Z]}>
      <mesh castShadow position={[0, TRAY_FLOOR / 2, 0]} receiveShadow>
        <boxGeometry args={[outer.width, TRAY_FLOOR, outer.depth]} />
        <SurfaceMaterial
          bump={0.04}
          color={VENN_COLORS.tray}
          repeat={[outer.width / 0.6, outer.depth / 0.075]}
          roughness={0.5}
          surface="wood"
        />
      </mesh>
      {Arr.map(rims, (rim) => (
        <mesh
          castShadow
          key={`${rim.at[0]}-${rim.at[1]}`}
          position={[rim.at[0], TRAY_FLOOR + 0.012, rim.at[1]]}
          receiveShadow
        >
          <boxGeometry args={[rim.size[0], 0.024, rim.size[1]]} />
          <SurfaceMaterial
            bump={0.04}
            color={VENN_COLORS.tray}
            repeat={[rim.size[0] / 0.6, 0.4]}
            roughness={0.5}
            surface="wood"
          />
        </mesh>
      ))}
    </group>
  );
}
