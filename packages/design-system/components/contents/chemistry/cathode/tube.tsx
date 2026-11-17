import { Line, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  beamHeight,
  beamPath,
  spotHeight,
  TUBE,
} from "@repo/design-system/components/contents/chemistry/cathode/beam";
import {
  ENVELOPE,
  envelopeOutline,
  envelopeRadius,
} from "@repo/design-system/components/contents/chemistry/cathode/envelope";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  MetalMaterial,
  VesselGlassMaterial,
} from "@repo/design-system/components/three/physical";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { createRef, useMemo } from "react";
import { Color, DoubleSide, type Mesh, Vector2 } from "three";

/** Where the cathode stands on the tube's axis. */
const CATHODE_X = -3.5;

/** Where the anode, a disc with a hole in its middle, stands. */
const ANODE_X = -0.6;

/** How many electrons drift along the beam while the card plays. */
const ELECTRONS = 14;

/** How fast the drifting electrons move, in scene units a second. */
const DRIFT = 4;

/** How thick the glass wall of the envelope is, about 1.5 mm. */
const WALL = 0.06;

/** The radius of the thin side arms that carry the anode's and the plates' leads out. */
const ARM = 0.16;

/** How far a side arm stands out of the neck. */
const ARM_LENGTH = 0.85;

/** The radius of a lead wire inside the glass. */
const LEAD = 0.025;

/** The grid lines printed on the screen, one every centimetre. */
const GRID_STEP = 0.4;

/**
 * Thomson's tube as it stands on a lab bench: one lathe-blown glass envelope
 * with its cathode stem, side arms that carry the anode's and the plates'
 * leads out through the glass, the plates between which the beam bends, and
 * the zinc sulfide screen with its centimetre grid, where a green spot glows.
 * The beam itself leaves a faint violet trace in the gas a tube never pumps
 * out completely, and electrons drift along it while the card plays.
 */
export function CathodeTube({ plate }: { readonly plate: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const end = TUBE.plates + TUBE.screen;
  const spot = new Color(BENCH_COLORS.phosphorGlow).multiplyScalar(2.6);
  const trace = new Color(BENCH_COLORS.residualGasGlow).multiplyScalar(1.6);
  const outline = useMemo(
    () => Arr.map(envelopeOutline(160), ([r, x]) => new Vector2(r, x)),
    []
  );
  const path = useMemo(
    () =>
      Arr.prepend(
        Arr.map(beamPath(plate, 120), ([x, y]) => [x, y, 0] as const),
        [CATHODE_X, 0, 0] as const
      ),
    [plate]
  );
  const electrons = useMemo(
    () =>
      Arr.map(Arr.range(1, ELECTRONS), (index) => ({
        offset: ((end - CATHODE_X) * index) / ELECTRONS,
        ref: createRef<Mesh>(),
      })),
    [end]
  );

  useFrame((state) => {
    const seconds = playing ? state.clock.elapsedTime : 0;
    for (const electron of electrons) {
      const x =
        CATHODE_X + ((electron.offset + seconds * DRIFT) % (end - CATHODE_X));
      electron.ref.current?.position.set(x, beamHeight(x, plate), 0);
    }
  });

  return (
    <group>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry args={[outline, 96]} />
        <VesselGlassMaterial
          color={BENCH_COLORS.glass}
          thickness={WALL}
          tint={BENCH_COLORS.glassEdge}
        />
      </mesh>
      <SideArm x={ANODE_X} />
      <SideArm x={TUBE.plates / 2} />
      <SideArm down x={TUBE.plates / 2} />
      <CathodeStem />
      <Anode />
      <Plates plate={plate} />
      <Screen end={end} />
      <mesh
        position={[end - 0.015, spotHeight(plate), 0]}
        scale={[0.02, 0.16, 0.16]}
      >
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color={spot} toneMapped={false} />
      </mesh>
      <Line
        color={trace}
        lineWidth={5}
        opacity={0.18}
        points={path}
        toneMapped={false}
        transparent
      />
      <Line color={trace} lineWidth={1.4} points={path} toneMapped={false} />
      {Arr.map(electrons, (electron) => (
        <mesh key={electron.offset} ref={electron.ref}>
          <sphereGeometry args={[0.05, 12, 8]} />
          <meshBasicMaterial color={trace} toneMapped={false} />
        </mesh>
      ))}
      <TubeStand />
    </group>
  );
}

/**
 * A thin glass arm blown onto the neck at `x`, upward or `down`, with the
 * lead wire it carries out and the brass cap the wire is soldered to.
 */
function SideArm({
  down = false,
  x,
}: {
  readonly down?: boolean;
  readonly x: number;
}) {
  const side = down ? -1 : 1;
  const middle = side * (ENVELOPE.neck + ARM_LENGTH / 2 - 0.05);
  const tip = side * (ENVELOPE.neck + ARM_LENGTH);

  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, middle, 0]}>
        <cylinderGeometry args={[ARM, ARM, ARM_LENGTH, 32, 1, true]} />
        <VesselGlassMaterial
          color={BENCH_COLORS.glass}
          thickness={WALL}
          tint={BENCH_COLORS.glassEdge}
        />
      </mesh>
      <mesh position={[0, side * (ENVELOPE.neck / 2 + ARM_LENGTH / 2), 0]}>
        <cylinderGeometry
          args={[LEAD, LEAD, ENVELOPE.neck + ARM_LENGTH, 8, 1]}
        />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, tip + side * 0.08, 0]}>
        <cylinderGeometry args={[ARM + 0.03, ARM + 0.03, 0.18, 32]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * The cathode: a shallow nickel cup facing the anode, on a stem of lead
 * wires that runs back through a pinched glass seal to the brass cap at the
 * end of the tube.
 */
function CathodeStem() {
  const stem = CATHODE_X - ENVELOPE.end;

  return (
    <group>
      <mesh position={[CATHODE_X, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.36, 0.14, 40, 1]} />
        <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.38} />
      </mesh>
      {Arr.map([-0.12, 0.12] as const, (z) => (
        <mesh
          key={z}
          position={[CATHODE_X - stem / 2, 0, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[LEAD, LEAD, stem, 8, 1]} />
          <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.35} />
        </mesh>
      ))}
      <mesh
        position={[CATHODE_X - stem * 0.7, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.22, 0.3, stem * 0.5, 32, 1]} />
        <VesselGlassMaterial
          color={BENCH_COLORS.glass}
          thickness={0.2}
          tint={BENCH_COLORS.glassEdge}
        />
      </mesh>
      <mesh
        castShadow
        position={[ENVELOPE.end - 0.12, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.28, 0.28, 0.28, 40, 1]} />
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** The anode: a nickel disc with a small hole through which the beam passes, and the collar that holds it in the neck. */
function Anode() {
  return (
    <group position={[ANODE_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <ringGeometry args={[0.07, ENVELOPE.neck - 0.08, 48]} />
        <meshPhysicalMaterial
          color={INSTRUMENT_COLORS.aluminium}
          metalness={1}
          roughness={0.35}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, -0.18]}>
        <cylinderGeometry
          args={[ENVELOPE.neck - 0.08, ENVELOPE.neck - 0.08, 0.36, 48, 1, true]}
        />
        <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.42} />
      </mesh>
    </group>
  );
}

/**
 * The two deflecting plates, polished aluminium with rounded edges, each
 * carrying the sign of its charge, and the leads that reach them from the
 * side arms.
 */
function Plates({ plate }: { readonly plate: number }) {
  const top = plate >= 0 ? "+" : "-";
  const bottom = plate >= 0 ? "-" : "+";

  return (
    <group>
      {Arr.map(
        [
          { sign: top, y: TUBE.gap / 2 },
          { sign: bottom, y: -TUBE.gap / 2 },
        ] as const,
        (each) => (
          <group key={each.y}>
            <RoundedBox
              args={[TUBE.plates, 0.06, 1.2]}
              castShadow
              position={[TUBE.plates / 2, each.y + Math.sign(each.y) * 0.03, 0]}
              radius={0.025}
              smoothness={3}
            >
              <MetalMaterial
                color={INSTRUMENT_COLORS.aluminium}
                roughness={0.22}
              />
            </RoundedBox>
            <ThreeLabel
              color={ORIGIN_COLOR.LIGHT}
              fontSize="compact"
              outlineColor={ORIGIN_COLOR.DARK}
              outlineWidth={0.06}
              position={[
                TUBE.plates / 2 + 1.2,
                each.y + Math.sign(each.y) * 0.4,
                0.7,
              ]}
            >
              <InlineMath math={each.sign} />
            </ThreeLabel>
          </group>
        )
      )}
    </group>
  );
}

/**
 * The screen: a disc of zinc sulfide on mica inside the dome, printed with a
 * centimetre grid so the spot's height can be read.
 */
function Screen({ end }: { readonly end: number }) {
  const radius = envelopeRadius(end) - 0.08;
  const lines = useMemo(() => {
    const count = Math.floor(radius / GRID_STEP);
    return Arr.flatMap(Arr.range(-count, count), (index) => {
      const at = index * GRID_STEP;
      const half = Math.sqrt(Math.max(0, radius * radius - at * at));
      return [
        [
          [end - 0.012, at, -half],
          [end - 0.012, at, half],
        ],
        [
          [end - 0.012, -half, at],
          [end - 0.012, half, at],
        ],
      ] as const;
    });
  }, [end, radius]);

  return (
    <group>
      <mesh position={[end, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[radius, 72]} />
        <meshStandardMaterial
          color={BENCH_COLORS.phosphorCoat}
          roughness={0.9}
          side={DoubleSide}
        />
      </mesh>
      {Arr.map(lines, (points) => (
        <Line
          color={getColor("SLATE", 400)}
          key={`${points[0][1]}-${points[0][2]}`}
          lineWidth={0.6}
          opacity={0.5}
          points={points}
          transparent
        />
      ))}
    </group>
  );
}

/**
 * A walnut plinth with bevelled edges and two steel posts topped with brass
 * clamp rings, one round the neck and one round the bulb, which hold the
 * tube above the stage's floor.
 */
function TubeStand() {
  const { floor = 0 } = useStage();
  const clamps = [-2.4, (ENVELOPE.flare + ENVELOPE.shoulder) / 2] as const;

  return (
    <group>
      {Arr.map(clamps, (x) => {
        const radius = envelopeRadius(x) + 0.05;
        const post = -radius - floor - 0.3;
        return (
          <group key={x}>
            <mesh
              castShadow
              position={[x, 0, 0]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <torusGeometry args={[radius, 0.07, 16, 64]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
            </mesh>
            <mesh castShadow position={[x, floor + 0.3 + post / 2, 0]}>
              <cylinderGeometry args={[0.09, 0.09, post, 20, 1]} />
              <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
      <RoundedBox
        args={[ENVELOPE.apex - ENVELOPE.end + 0.6, 0.3, 2.6]}
        castShadow
        position={[(ENVELOPE.apex + ENVELOPE.end) / 2, floor + 0.15, 0]}
        radius={0.08}
        receiveShadow
        smoothness={4}
      >
        <meshPhysicalMaterial
          clearcoat={0.4}
          clearcoatRoughness={0.3}
          color={MACHINE_COLORS.walnut}
          roughness={0.55}
        />
      </RoundedBox>
    </group>
  );
}
