import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import { BenchCamera } from "@repo/design-system/components/contents/physics/bench/camera";
import { waveVectors } from "@repo/design-system/components/contents/physics/waves/tank/ripple";
import { Water } from "@repo/design-system/components/contents/physics/waves/tank/water";
import { refractWave } from "@repo/design-system/components/contents/physics/waves/wave";
import { Beam } from "@repo/design-system/components/three/optic/beam";
import { Arc } from "@repo/design-system/components/three/optic/board";
import { Slab } from "@repo/design-system/components/three/optic/glass";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { APPARATUS_COLORS } from "@repo/design-system/lib/material/apparatus";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { DoubleSide, Shape } from "three";

/** The water of the tank: its length along the boundary and across it, in scene units. */
const WIDE = 4.4;
const DEEP = 3.1;

/** How many deep-water wavelengths fit across the tank. */
const WAVES = 7;

/** How high the tray's glass floor stands on its legs, how thick it is, and how deep the deep water is. */
const LEGS = 0.85;
const FLOOR = 0.03;
const DEPTH = 0.085;

/** The height of still water above the bench, and how thick the plate that makes the near half shallow is. */
const LEVEL = LEGS + FLOOR + DEPTH;
const PLATE = 0.055;

/** How thick and how tall the walls of the tray are. */
const WALL = 0.07;
const WALL_TALL = 0.21;

/** How far behind the boundary the dipper hangs, and how long its bar is. */
const DIPPER_AT = -0.98;
const DIPPER_LONG = 1.1;

/** How high above the water the gantry carries the dipper. */
const GANTRY = 0.72;

/** How long each drawn ray is, and the radius of an angle's arc. */
const RAY = 1.15;
const ARC = 0.42;

/** Wall seconds a crest takes to move one wavelength, whatever the real frequency. */
const PERIOD_SECONDS = 1.1;

const DEGREE = Math.PI / 180;

/** The outline of a flat arrow `long` from its tail at the origin along +x. */
function arrowOutline(long: number) {
  const outline = new Shape();
  const head = 0.16;
  outline.moveTo(0, -0.02);
  outline.lineTo(long - head, -0.02);
  outline.lineTo(long - head, -0.065);
  outline.lineTo(long, 0);
  outline.lineTo(long - head, 0.065);
  outline.lineTo(long - head, 0.02);
  outline.lineTo(0, 0.02);
  outline.closePath();
  return outline;
}

/** A ray drawn just over the water, `RAY` long from `from` in the direction `angle` on the page of the surface. */
function Ray({
  angle,
  color,
  from,
}: {
  readonly angle: number;
  readonly color: string;
  readonly from: readonly [number, number];
}) {
  const outline = useMemo(() => arrowOutline(RAY), []);

  return (
    <group position={[from[0], 0, from[1]]} rotation={[0, angle, 0]}>
      <mesh renderOrder={9} rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[outline]} />
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}

/** One wall of the tray, `long` by the wall's own thickness: a varnished beech rail with a foam beach inside it. */
function Wall({
  at,
  long,
  turn,
}: {
  readonly at: readonly [number, number];
  readonly long: number;
  readonly turn: number;
}) {
  return (
    <group position={[at[0], 0, at[1]]} rotation={[0, turn, 0]}>
      <mesh castShadow position={[0, WALL_TALL / 2, 0]} receiveShadow>
        <boxGeometry args={[long, WALL_TALL, WALL]} />
        <SurfaceMaterial
          coat={0.4}
          color={APPARATUS_COLORS.beechWood}
          repeat={[long * 0.6, 1]}
          roughness={0.55}
          surface="wood"
        />
      </mesh>
      <mesh
        position={[0, FLOOR + DEPTH * 0.7, WALL / 2 + 0.085]}
        rotation={[0.42, 0, 0]}
      >
        <boxGeometry args={[long - WALL * 2.4, 0.03, 0.21]} />
        <SurfaceMaterial
          bump={1}
          color={APPARATUS_COLORS.foamCup}
          repeat={[long * 4, 1]}
          roughness={1}
          surface="cloth"
        />
      </mesh>
    </group>
  );
}

/** The tray: a floor of plate glass in four beech walls, on a steel leg with a rubber foot at each corner. */
function Tray() {
  const x = WIDE / 2 + WALL / 2;
  const z = DEEP / 2 + WALL / 2;

  return (
    <group>
      <group position={[0, LEGS, 0]}>
        <mesh position={[0, FLOOR / 2, 0]} renderOrder={2}>
          <boxGeometry args={[WIDE, FLOOR, DEEP]} />
          <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.22} />
        </mesh>
        <Wall at={[0, -z]} long={WIDE + WALL * 2} turn={0} />
        <Wall at={[0, z]} long={WIDE + WALL * 2} turn={Math.PI} />
        <Wall at={[-x, 0]} long={DEEP} turn={Math.PI / 2} />
        <Wall at={[x, 0]} long={DEEP} turn={-Math.PI / 2} />
      </group>
      {Arr.map(
        [
          { key: "farLeft", x: -x, z: -z },
          { key: "farRight", x, z: -z },
          { key: "nearRight", x, z },
          { key: "nearLeft", x: -x, z },
        ],
        (leg) => (
          <group key={leg.key} position={[leg.x, 0, leg.z]}>
            <mesh castShadow position={[0, LEGS / 2 + 0.01, 0]}>
              <cylinderGeometry args={[0.028, 0.028, LEGS - 0.02, 24]} />
              <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.26} />
            </mesh>
            <mesh castShadow position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.04, 28]} />
              <SurfaceMaterial
                color={APPARATUS_COLORS.rubberFoot}
                roughness={0.9}
                surface="rubber"
              />
            </mesh>
            <mesh castShadow position={[0, LEGS - 0.03, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.06, 28]} />
              <SurfaceMaterial
                color={INSTRUMENT_COLORS.aluminium}
                metalness={1}
                repeat={[6, 1]}
                roughness={0.3}
                surface="knurl"
              />
            </mesh>
          </group>
        )
      )}
    </group>
  );
}

/**
 * The straight dipper: a bar that touches the water, hung on two wires from
 * a beam that carries the motor whose off-centre weight shakes it. The beam
 * turns on a pivot under a gantry across the tray, so the crests it sends
 * out travel at `incidence` degrees to the normal of the boundary.
 */
function Dipper({ incidence }: { readonly incidence: number }) {
  const post = WIDE / 2 + WALL / 2;

  return (
    <group position={[0, LEVEL, DIPPER_AT]}>
      {Arr.map([-post, post], (x) => (
        <mesh castShadow key={x} position={[x, GANTRY / 2 + 0.03, 0]}>
          <cylinderGeometry args={[0.02, 0.02, GANTRY + 0.2, 20]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.26} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, GANTRY + 0.1, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.018, 0.018, post * 2 + 0.12, 20]} />
        <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.26} />
      </mesh>
      <mesh castShadow position={[0, GANTRY + 0.1, 0]}>
        <boxGeometry args={[0.09, 0.08, 0.08]} />
        <MetalMaterial color={APPARATUS_COLORS.caseSteel} roughness={0.4} />
      </mesh>
      <group rotation={[0, incidence * DEGREE, 0]}>
        <mesh castShadow position={[0, GANTRY * 0.72, 0]}>
          <cylinderGeometry args={[0.012, 0.012, GANTRY * 0.56, 16]} />
          <MetalMaterial color={APPARATUS_COLORS.nickel} roughness={0.26} />
        </mesh>
        <mesh castShadow position={[0, GANTRY * 0.42, 0]}>
          <boxGeometry args={[DIPPER_LONG + 0.12, 0.05, 0.07]} />
          <SurfaceMaterial
            coat={0.3}
            color={APPARATUS_COLORS.beechWood}
            repeat={[3, 1]}
            roughness={0.6}
            surface="wood"
          />
        </mesh>
        <mesh
          castShadow
          position={[0.2, GANTRY * 0.42 + 0.06, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.05, 0.05, 0.11, 32]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.anodised}
            metalness={1}
            repeat={[6, 1]}
            roughness={0.4}
            surface="brushed"
          />
        </mesh>
        <mesh
          castShadow
          position={[0.2, GANTRY * 0.42 + 0.06, 0.07]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.03, 24]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.3} />
        </mesh>
        {Arr.map([-DIPPER_LONG / 2 + 0.05, DIPPER_LONG / 2 - 0.05], (x) => (
          <mesh key={x} position={[x, GANTRY * 0.21, 0]}>
            <cylinderGeometry args={[0.004, 0.004, GANTRY * 0.42, 8]} />
            <MetalMaterial color={INSTRUMENT_COLORS.silver} roughness={0.3} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.012, 0]}>
          <boxGeometry args={[DIPPER_LONG, 0.03, 0.03]} />
          <SurfaceMaterial
            color={INSTRUMENT_COLORS.aluminium}
            metalness={1}
            repeat={[4, 1]}
            roughness={0.32}
            surface="brushed"
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A ripple tank on its legs, with a glass plate under the near half that
 * makes the water there shallow. The dipper sends straight crests across
 * the step: the water's surface is the wave itself on both sides, so the
 * crests close up to the shorter wavelength and turn toward the normal
 * where they slow down. Over the water lie the ray along the direction of
 * travel on each side, the normal, and the two angles.
 */
export function TankScene({
  deep,
  incidence,
  shallow,
  wavelength,
}: {
  /** The wave speed in the deep water, in centimetres per second. */
  readonly deep: number;
  /** The angle of incidence, in degrees. */
  readonly incidence: number;
  /** The wave speed in the shallow water, in centimetres per second. */
  readonly shallow: number;
  /** The wavelength in the deep water, in centimetres. */
  readonly wavelength: number;
}) {
  const wave = { incidence, speed: deep, wavelength };
  const unit = DEEP / (WAVES * wavelength);
  const vectors = useMemo(
    () => waveVectors({ incidence, speed: deep, wavelength }, shallow, unit),
    [deep, incidence, shallow, unit, wavelength]
  );
  const turn = incidence * DEGREE;
  const bend = refractWave(wave, shallow).refraction * DEGREE;

  return (
    <group>
      <BenchCamera
        narrow={[0.3, 7.6, 8.4]}
        target={[0, 0.95, 0.1]}
        wide={[0.2, 4.9, 4.9]}
      />
      <SeamlessBenchSurface />
      <Tray />
      <group position={[0, LEGS + FLOOR, DEEP / 4]}>
        <Slab deep={DEEP / 2 - 0.02} tall={PLATE} wide={WIDE - 0.04} />
      </group>
      <group position={[0, LEVEL, 0]}>
        <Water
          deep={DEEP}
          period={PERIOD_SECONDS}
          vectors={vectors}
          wide={WIDE}
        />
      </group>
      <Dipper incidence={incidence} />
      <group position={[0, LEVEL + 0.03, 0]}>
        <Beam
          color={INSTRUMENT_COLORS.paper}
          dashed
          points={[
            [0, 0, -RAY],
            [0, 0, RAY],
          ]}
          strength={0.9}
          width={0.008}
        />
        <Ray
          angle={-Math.PI / 2 + turn}
          color={PLOT_COLORS.amber}
          from={[-Math.sin(turn) * RAY, -Math.cos(turn) * RAY]}
        />
        <Ray
          angle={-Math.PI / 2 + bend}
          color={PLOT_COLORS.pink}
          from={[0, 0]}
        />
        <Arc
          color={PLOT_COLORS.amber}
          from={Math.PI / 2}
          radius={ARC}
          to={Math.PI / 2 + turn}
        />
        <Arc
          color={PLOT_COLORS.pink}
          from={-Math.PI / 2}
          radius={ARC}
          to={-Math.PI / 2 + bend}
        />
      </group>
    </group>
  );
}
