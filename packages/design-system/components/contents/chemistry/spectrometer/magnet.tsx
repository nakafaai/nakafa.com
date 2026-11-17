import { RoundedBox } from "@react-three/drei";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { CatmullRomCurve3, Color, Shape, Vector3 } from "three";

/** Where the lower pole's face stands, just under the plane the ions fly in. */
const POLE_FACE = 0.2;

/** How thick each pole piece is. */
const POLE = 0.5;

/** How far above the ions' plane the upper pole frame stands. */
const UPPER = 0.55;

/** How wide the copper winding round the lower pole is. */
const COIL = 0.42;

/** The bevel every machined steel edge carries. */
const BEVEL = {
  bevelEnabled: true,
  bevelSegments: 3,
  bevelSize: 0.03,
  bevelThickness: 0.03,
  curveSegments: 64,
} as const;

/**
 * A D-shaped outline in the plane of the ions' flight, the curve on the far
 * side: a half disc of `outer` radius, or, with an `inner` radius, the
 * half ring between the two, drawn as one outline that runs out along the
 * outer arc and back along the inner one. A hole would touch the straight
 * edge, which the triangulation cannot cut out.
 */
function halfDisc(outer: number, inner = 0) {
  const shape = new Shape();
  shape.moveTo(outer, 0);
  shape.absarc(0, 0, outer, 0, Math.PI, false);
  if (inner > 0) {
    shape.lineTo(-inner, 0);
    shape.absarc(0, 0, inner, Math.PI, 0, true);
  }
  shape.lineTo(outer, 0);
  return shape;
}

/**
 * The electromagnet of a 180° magnetic sector, centred on the ions' half
 * circles: a bevelled steel lower pole piece wound with a copper coil, the
 * stainless wall of the vacuum chamber the ions fly in, and the upper pole
 * as a steel frame round a thin glass viewing window, so the beams show as a
 * teaching instrument's cutaway shows them. The window stays plain clear
 * glass: a transmissive one would hide the beams, which it never renders.
 */
export function SectorMagnet({
  centre,
  radius,
}: {
  readonly centre: number;
  readonly radius: number;
}) {
  const shapes = useMemo(
    () => ({
      coil: halfDisc(radius + COIL, radius + 0.04),
      frame: halfDisc(radius + 0.3, radius - 0.5),
      pole: halfDisc(radius),
      wall: halfDisc(radius + 0.06, radius - 0.02),
      window: halfDisc(radius - 0.45),
    }),
    [radius]
  );

  return (
    <group position={[centre, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh castShadow position={[0, 0, POLE_FACE - POLE]} receiveShadow>
        <extrudeGeometry args={[shapes.pole, { ...BEVEL, depth: POLE }]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, 0, POLE_FACE - POLE - 0.05]}>
        <extrudeGeometry
          args={[shapes.coil, { ...BEVEL, bevelSize: 0.06, depth: 0.3 }]}
        />
        <MetalMaterial color={INSTRUMENT_COLORS.copper} roughness={0.48} />
      </mesh>
      <mesh castShadow position={[0, 0, POLE_FACE]}>
        <extrudeGeometry
          args={[
            shapes.wall,
            { ...BEVEL, bevelSize: 0.01, depth: UPPER - POLE_FACE },
          ]}
        />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 0, UPPER]}>
        <extrudeGeometry args={[shapes.frame, { ...BEVEL, depth: 0.14 }]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0, UPPER + 0.05]}>
        <shapeGeometry args={[shapes.window, 64]} />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.14} />
      </mesh>
    </group>
  );
}

/**
 * The ion source in front of the magnet's entrance: a stainless chamber where
 * an electron gun's glowing filament ionises the vapour, two accelerating
 * plates with slits that send the ions in at one speed per charge, and the
 * black hose to the vacuum pump.
 */
export function IonSource({ at }: { readonly at: number }) {
  const filament = new Color(BENCH_COLORS.coalGlow).multiplyScalar(2.2);
  const hose = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-0.4, 0.3, at + 0.5),
        new Vector3(-1.4, 0.25, at + 0.9),
        new Vector3(-2.6, 0.12, at + 0.4),
        new Vector3(-3.6, 0.1, at - 0.8),
      ]),
    [at]
  );

  return (
    <group>
      <mesh
        castShadow
        position={[0, 0.34, at + 0.55]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.32, 0.32, 0.9, 40, 1]} />
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.26} />
      </mesh>
      <mesh position={[0, 0.34, at + 0.2]}>
        <boxGeometry args={[0.18, 0.04, 0.04]} />
        <meshBasicMaterial color={filament} toneMapped={false} />
      </mesh>
      {Arr.map([at - 0.1, at - 0.35] as const, (z) => (
        <RoundedBox
          args={[0.7, 0.5, 0.04]}
          castShadow
          key={z}
          position={[0, 0.3, z]}
          radius={0.012}
          smoothness={2}
        >
          <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.24} />
        </RoundedBox>
      ))}
      <mesh castShadow>
        <tubeGeometry args={[hose, 48, 0.09, 16, false]} />
        <meshStandardMaterial color={BENCH_COLORS.epoxy} roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * The detector along the magnet's diameter: a stainless housing with the
 * copper collector strip that each isotope's ions strike at its own place.
 */
export function Detector({
  from,
  to,
}: {
  readonly from: number;
  readonly to: number;
}) {
  const length = to - from;

  return (
    <group position={[(from + to) / 2, 0, 0.32]}>
      <RoundedBox
        args={[length, 0.36, 0.22]}
        castShadow
        position={[0, 0.3, 0.06]}
        radius={0.03}
        receiveShadow
        smoothness={3}
      >
        <MetalMaterial color={BENCH_COLORS.panSteel} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.3, -0.06]}>
        <boxGeometry args={[length - 0.2, 0.12, 0.02]} />
        <MetalMaterial color={INSTRUMENT_COLORS.copper} roughness={0.35} />
      </mesh>
    </group>
  );
}
