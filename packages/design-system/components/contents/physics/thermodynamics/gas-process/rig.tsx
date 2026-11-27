import { useFrame } from "@react-three/fiber";
import {
  EnergyArrow,
  FLOOR,
  Keeper,
  needleAngle,
  PressureGauge,
  Stand,
  Thermometer,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/apparatus";
import type { GasMoment } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import {
  arrowSpan,
  CYLINDER,
  columnHeight,
  MOLECULES,
  moleculePace,
  moleculePlace,
  plateGlow,
  warmth,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import type { GasProcess } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { GAS_COLORS } from "@repo/design-system/lib/material/gas";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { RefObject } from "react";
import { useMemo, useRef } from "react";
import type { Group, InstancedMesh, Mesh, MeshStandardMaterial } from "three";
import { Color, Object3D } from "three";

/** The piston's disc and the rod that rises from it to its knob, in metres. */
const PISTON = { rod: 0.25, thickness: 0.022 } as const;

/** The brass weights that load an isobaric piston, from the lowest up: how far each stands in from the bore, and its height. */
const WEIGHTS = [
  { height: 0.014, inset: 0.008 },
  { height: 0.012, inset: 0.013 },
  { height: 0.01, inset: 0.019 },
] as const;

/** How far apart the marks on the glass stand, in metres. */
const GRADUATION = 0.02;

/** The bearing round the glass the scale is printed at, in radians from its right side toward its front: clear of the molecules a camera sees through the middle. */
const SCALE_BEARING = 0.62;

/** How fast the molecules fly at the start temperature, in crossings a second. */
const PACE = 0.32;

/** What an energy arrow lets a scene do each frame: span it along its axis. */
type ArrowHandle = RefObject<{
  readonly span: (from: number, to: number) => void;
} | null>;

/** Spans an energy arrow for an energy, if the arrow is shown. */
function spanArrow(
  arrow: ArrowHandle,
  span: { readonly from: number; readonly to: number }
) {
  arrow.current?.span(span.from, span.to);
}

/** Sets every molecule where it flies after `clock`, under a piston `height` above the floor. */
function flyMolecules(
  flock: InstancedMesh | null,
  place: Object3D,
  moment: { readonly clock: number; readonly height: number }
) {
  if (flock === null) {
    return;
  }
  for (let index = 0; index < MOLECULES; index += 1) {
    const at = moleculePlace(index, moment.clock, moment.height);
    place.position.set(at.x, FLOOR + at.y, at.z);
    place.updateMatrix();
    flock.setMatrixAt(index, place.matrix);
  }
  flock.instanceMatrix.needsUpdate = true;
}

/**
 * The gas's cylinder on its stand: a glass tube on a steel cap, the gas in
 * it tinted from cool blue to warm amber as it heats, its molecules flying
 * faster as it heats, and the piston on top of it with its rod and knob. An
 * isobaric piston carries a slotted brass weight, which keeps the pressure;
 * an isochoric piston is held by a steel pin through the glass, which keeps
 * the volume. The water bath or the foam jacket of the other processes
 * stands round the glass, and the plate under it glows while it heats or
 * cools the gas. The orange arrow is the heat Q crossing the wall, the teal
 * one the work W the gas does on the piston, each as long as its energy and
 * pointing the way it flows; a digital thermometer reads the gas's
 * temperature. Everything follows `now`, which the scene moves along the
 * process while it plays.
 */
export function GasRig({
  fullPressure,
  heatShown,
  kelvin,
  largest,
  longest,
  now,
  process,
  scale,
  span,
  startVolume,
  workShown,
}: {
  /** The pressure at the end of the gauge's scale. */
  readonly fullPressure: number;
  readonly heatShown: boolean;
  readonly kelvin: (temperature: number) => string;
  readonly largest: number;
  readonly longest: number;
  readonly now: RefObject<GasMoment>;
  readonly process: GasProcess;
  readonly scale: number;
  readonly span: {
    readonly high: number;
    readonly low: number;
    readonly start: number;
  };
  readonly startVolume: number;
  readonly workShown: boolean;
}) {
  const piston = useRef<Group>(null);
  const gas = useRef<Mesh>(null);
  const tint = useRef<MeshStandardMaterial>(null);
  const plate = useRef<MeshStandardMaterial>(null);
  const molecules = useRef<InstancedMesh>(null);
  const reading = useRef<HTMLSpanElement>(null);
  const work = useRef<Group>(null);
  const needle = useRef<Group>(null);
  const heatArrow: ArrowHandle = useRef(null);
  const workArrow: ArrowHandle = useRef(null);
  const clock = useRef(0);
  const scratch = useMemo(
    () => ({
      cold: new Color(GAS_COLORS.gasCold),
      frost: new Color(GAS_COLORS.plateCold),
      glow: new Color(GAS_COLORS.plateHot),
      hot: new Color(GAS_COLORS.gasHot),
      place: new Object3D(),
    }),
    []
  );
  const radius = CYLINDER.radius;
  const pinHeight =
    FLOOR + columnHeight(startVolume, largest) + PISTON.thickness + 0.005;

  useFrame((_, delta) => {
    const { energy, playing, state } = now.current;
    const height = columnHeight(state.volume, largest);
    piston.current?.position.set(0, FLOOR + height, 0);
    gas.current?.position.set(0, FLOOR + height / 2, 0);
    gas.current?.scale.set(1, Math.max(height, 1e-4), 1);
    tint.current?.color.lerpColors(
      scratch.cold,
      scratch.hot,
      warmth(state.temperature, span)
    );
    const glow = plateGlow(process, energy.heat, scale);
    plate.current?.emissive.copy(glow.cold ? scratch.frost : scratch.glow);
    if (plate.current !== null) {
      plate.current.emissiveIntensity = glow.strength;
    }
    spanArrow(heatArrow, arrowSpan(energy.heat, scale, longest, "wall"));
    spanArrow(workArrow, arrowSpan(energy.work, scale, longest, "middle"));
    work.current?.position.set(
      radius + 0.045,
      FLOOR + height + PISTON.thickness / 2,
      0
    );
    needle.current?.rotation.set(
      0,
      0,
      needleAngle(state.pressure, fullPressure)
    );
    const text = kelvin(state.temperature);
    if (reading.current !== null && reading.current.textContent !== text) {
      reading.current.textContent = text;
    }
    if (playing) {
      clock.current +=
        Math.min(delta, 0.1) *
        PACE *
        moleculePace(state.temperature, span.start);
    }
    flyMolecules(molecules.current, scratch.place, {
      clock: clock.current,
      height,
    });
  });

  return (
    <group>
      <Stand plate={plate} />
      <Keeper process={process} />
      <mesh position={[0, FLOOR - 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[radius + 0.008, radius + 0.008, 0.012, 48]} />
        <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.35} />
      </mesh>
      <mesh position={[0, FLOOR + CYLINDER.height / 2, 0]}>
        <cylinderGeometry
          args={[radius + 0.002, radius + 0.002, CYLINDER.height, 48, 1, true]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.14} />
      </mesh>
      {/* The fire-polished rim of the glass and the steel collar it stands in */}
      <mesh
        position={[0, FLOOR + CYLINDER.height, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[radius + 0.002, 0.0022, 16, 72]} />
        <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.42} />
      </mesh>
      <mesh
        castShadow
        position={[0, FLOOR + 0.004, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[radius + 0.004, 0.004, 16, 72]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.22} />
      </mesh>
      {/* The scale printed on the glass, a longer mark at every other step */}
      {Arr.map(
        Arr.range(1, Math.floor(CYLINDER.height / GRADUATION) - 1),
        (step) => (
          <mesh
            key={step}
            position={[0, FLOOR + step * GRADUATION, 0]}
            rotation={[
              Math.PI / 2,
              0,
              SCALE_BEARING - (step % 2 === 0 ? 0.24 : 0.13),
            ]}
          >
            <torusGeometry
              args={[
                radius + 0.0024,
                0.000_35,
                6,
                24,
                step % 2 === 0 ? 0.48 : 0.26,
              ]}
            />
            <meshBasicMaterial color={BENCH_COLORS.glassMarking} />
          </mesh>
        )
      )}
      <mesh ref={gas}>
        <cylinderGeometry args={[radius - 0.0008, radius - 0.0008, 1, 40]} />
        <meshStandardMaterial
          depthWrite={false}
          opacity={0.2}
          ref={tint}
          roughness={0.9}
          transparent
        />
      </mesh>
      <instancedMesh args={[undefined, undefined, MOLECULES]} ref={molecules}>
        <sphereGeometry args={[0.0042, 20, 14]} />
        <meshStandardMaterial
          color={GAS_COLORS.molecule}
          metalness={0.1}
          roughness={0.28}
        />
      </instancedMesh>
      <group ref={piston}>
        <Piston weighted={process === "isobaric"} />
      </group>
      {process === "isochoric" ? <RetainingPins height={pinHeight} /> : null}
      <group
        position={[-(radius + 0.016), FLOOR + 0.035, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        {heatShown ? (
          <EnergyArrow
            color={PLOT_COLORS.orange}
            handle={heatArrow}
            name="Q"
            side={-0.024}
          />
        ) : null}
      </group>
      <group ref={work}>
        {workShown ? (
          <EnergyArrow
            color={PLOT_COLORS.teal}
            handle={workArrow}
            name="W"
            side={0.024}
          />
        ) : null}
      </group>
      <PressureGauge needle={needle} />
      <Thermometer reading={reading} />
    </group>
  );
}

/**
 * The two steel pins that hold an isochoric piston: they cross over it
 * through the glass, each with a knurled brass head at either end, so the
 * piston cannot rise and the volume stays.
 */
function RetainingPins({ height }: { readonly height: number }) {
  const reach = CYLINDER.radius + 0.022;
  return (
    <group position={[0, height, 0]}>
      {Arr.map([0, Math.PI / 2], (turn) => (
        <group key={turn} rotation={[0, turn, 0]}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.0032, 0.0032, 2 * reach, 20]} />
            <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.2} />
          </mesh>
          {Arr.map([-1, 1], (side) => (
            <mesh
              castShadow
              key={side}
              position={[side * reach, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.0068, 0.0068, 0.009, 14]} />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.42} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * The piston: a machined steel disc with a chamfered crown, sealed against
 * the glass by two rubber rings in their grooves, its polished rod and black
 * knob, and on an isobaric piston a stack of slotted brass weights.
 */
function Piston({ weighted }: { readonly weighted: boolean }) {
  const radius = CYLINDER.radius;
  const stack = Arr.reduce(
    WEIGHTS,
    {
      placed: Arr.empty<{ at: number; height: number; inset: number }>(),
      top: PISTON.thickness + 0.001,
    },
    (pile, weight) => ({
      placed: Arr.append(pile.placed, {
        at: pile.top + weight.height / 2,
        height: weight.height,
        inset: weight.inset,
      }),
      top: pile.top + weight.height + 0.0012,
    })
  ).placed;
  return (
    <group>
      <mesh castShadow position={[0, (PISTON.thickness - 0.003) / 2, 0]}>
        <cylinderGeometry
          args={[
            radius - 0.0009,
            radius - 0.0009,
            PISTON.thickness - 0.003,
            64,
          ]}
        />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.38} />
      </mesh>
      <mesh castShadow position={[0, PISTON.thickness - 0.0015, 0]}>
        <cylinderGeometry args={[radius - 0.004, radius - 0.0009, 0.003, 64]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.3} />
      </mesh>
      {Arr.map([0.3, 0.68], (share) => (
        <mesh
          key={share}
          position={[0, PISTON.thickness * share, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[radius - 0.0012, 0.0017, 12, 72]} />
          <meshStandardMaterial
            color={BENCH_COLORS.leadBlack}
            roughness={0.72}
          />
        </mesh>
      ))}
      <mesh castShadow position={[0, PISTON.thickness + 0.004, 0]}>
        <cylinderGeometry args={[0.009, 0.011, 0.008, 32]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, PISTON.thickness + PISTON.rod / 2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, PISTON.rod, 24]} />
        <MetalMaterial color={BENCH_COLORS.probeSteel} roughness={0.16} />
      </mesh>
      <mesh castShadow position={[0, PISTON.thickness + PISTON.rod, 0]}>
        <sphereGeometry args={[0.013, 32, 24]} />
        <meshStandardMaterial color={BENCH_COLORS.stopper} roughness={0.5} />
      </mesh>
      {weighted
        ? Arr.map(stack, (weight) => (
            <mesh castShadow key={weight.inset} position={[0, weight.at, 0]}>
              <cylinderGeometry
                args={[
                  radius - weight.inset,
                  radius - weight.inset,
                  weight.height,
                  56,
                ]}
              />
              <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
            </mesh>
          ))
        : null}
    </group>
  );
}
