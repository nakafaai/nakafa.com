import { RoundedBox } from "@react-three/drei";
import { Bench } from "@repo/design-system/components/contents/physics/vector/solid/bench";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  DoubleSide,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** The tube: its inner radius, its height, and the height of its foot, in metres. */
export const TUBE = {
  base: 0.06,
  gauge: 0.058,
  height: 1.3,
  radius: 0.07,
} as const;

/** The top of the glass, where the upper cap closes it. */
const TOP = TUBE.base + TUBE.height;

/** Where the side branch leaves the lower cap, and where its parts sit along it. */
const BRANCH = { gauge: 0.25, height: 0.075, hose: 0.3, tap: 0.16 } as const;

/** Where the pump stands on the bench, and the height of its inlet. */
const PUMP = { inlet: 0.215, x: 0.66, z: 0.02 } as const;

/** The heights at which the stand's two clamps hold the tube. */
const CLAMPS = [0.4, 1.08] as const;

/** Polished brass, as the caps, the tap and the fittings are turned from. */
export function Brass({ roughness = 0.2 }: { readonly roughness?: number }) {
  return (
    <SurfaceMaterial
      bump={0.15}
      color={INSTRUMENT_COLORS.brass}
      metalness={1}
      repeat={[4, 1]}
      roughness={roughness}
      surface="brushed"
    />
  );
}

/** Turns a profile of radius and height about the tube's axis. */
function turned(profile: readonly (readonly [number, number])[]) {
  return new LatheGeometry(
    Arr.map(profile, ([radius, height]) => new Vector2(radius, height)),
    64
  );
}

/** The lower cap on its spreading foot, and the upper cap with its release knob. */
function capGeometries() {
  const wall = TUBE.radius + 0.004;
  return {
    foot: turned([
      [0, 0],
      [0.118, 0],
      [0.118, 0.01],
      [0.096, 0.02],
      [0.086, 0.034],
      [0.086, 0.04],
      [wall + 0.016, 0.044],
      [wall + 0.016, 0.1],
      [wall + 0.012, 0.106],
      [wall + 0.001, 0.106],
    ]),
    top: turned([
      [wall + 0.001, TOP - 0.046],
      [wall + 0.012, TOP - 0.046],
      [wall + 0.016, TOP - 0.04],
      [wall + 0.016, TOP + 0.004],
      [wall + 0.004, TOP + 0.014],
      [0.03, TOP + 0.02],
      [0.014, TOP + 0.024],
      [0.014, TOP + 0.04],
      [0.024, TOP + 0.042],
      [0.024, TOP + 0.062],
      [0.02, TOP + 0.066],
      [0, TOP + 0.066],
    ]),
  };
}

/** The vacuum hose's path from the branch, sagging onto the bench, up to the pump. */
function hoseGeometry() {
  const path = new CatmullRomCurve3([
    new Vector3(BRANCH.hose, BRANCH.height, 0),
    new Vector3(BRANCH.hose + 0.07, BRANCH.height - 0.01, 0.01),
    new Vector3(BRANCH.hose + 0.14, 0.022, 0.06),
    new Vector3(PUMP.x - 0.12, 0.02, 0.12),
    new Vector3(PUMP.x - 0.06, 0.07, 0.13),
    new Vector3(PUMP.x - 0.045, PUMP.inlet + 0.05, 0.08),
    new Vector3(PUMP.x - 0.06, PUMP.inlet + 0.062, PUMP.z + 0.02),
    new Vector3(PUMP.x - 0.07, PUMP.inlet + 0.02, PUMP.z),
  ]);
  return new TubeGeometry(path, 80, 0.011, 12);
}

/**
 * The glass tube between its brass caps: the lower cap on a spreading foot,
 * the upper cap with the knob that lets the coin and the feather go, and a
 * ground-glass band where each cap seals the glass.
 */
function CappedTube() {
  const caps = useMemo(capGeometries, []);
  useEffect(
    () => () => {
      caps.foot.dispose();
      caps.top.dispose();
    },
    [caps]
  );

  return (
    <group>
      <mesh castShadow geometry={caps.foot} receiveShadow>
        <Brass />
      </mesh>
      <mesh castShadow geometry={caps.top}>
        <Brass />
      </mesh>
      <mesh position={[0, TUBE.base + TUBE.height / 2, 0]}>
        <cylinderGeometry
          args={[
            TUBE.radius + 0.004,
            TUBE.radius + 0.004,
            TUBE.height,
            64,
            1,
            true,
          ]}
        />
        <GlassMaterial color={BENCH_COLORS.glass} opacity={0.2} />
      </mesh>
      {Arr.map([0.112, TOP - 0.052], (height) => (
        <mesh key={height} position={[0, height, 0]}>
          <cylinderGeometry
            args={[
              TUBE.radius + 0.0045,
              TUBE.radius + 0.0045,
              0.012,
              64,
              1,
              true,
            ]}
          />
          <meshStandardMaterial
            color={BENCH_COLORS.glassEdge}
            opacity={0.55}
            roughness={0.6}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The side branch of the lower cap: a brass pipe with a quarter-turn tap, the
 * gauge that reads the pressure left in the tube, and the barb the hose
 * pushes onto. The tap's lever lies along the pipe while the pump draws.
 */
function Branch({ children }: { readonly children: ReactNode }) {
  return (
    <group position={[0, BRANCH.height, 0]}>
      <mesh
        castShadow
        position={[(BRANCH.hose + 0.08) / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.011, 0.011, BRANCH.hose - 0.08, 20]} />
        <Brass />
      </mesh>
      <group position={[BRANCH.tap, 0, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.046, 6]} />
          <Brass roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.018, 12]} />
          <Brass />
        </mesh>
        <RoundedBox
          args={[0.085, 0.01, 0.018]}
          castShadow
          position={[0.022, 0.042, 0]}
          radius={0.004}
          smoothness={2}
        >
          <SurfaceMaterial color={MACHINE_COLORS.gripRed} surface="paint" />
        </RoundedBox>
      </group>
      <group position={[BRANCH.gauge, 0, 0]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.017, 0.017, 0.03, 6]} />
          <Brass roughness={0.3} />
        </mesh>
        <mesh castShadow position={[0, 0.045, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.07, 12]} />
          <Brass />
        </mesh>
        <mesh position={[0, 0.075, 0]}>
          <cylinderGeometry args={[0.013, 0.013, 0.016, 6]} />
          <Brass roughness={0.3} />
        </mesh>
        <group position={[0, 0.142, 0]}>{children}</group>
      </group>
      {Arr.map([0.012, 0.024, 0.036], (along) => (
        <mesh
          key={along}
          position={[BRANCH.hose - 0.046 + along, 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
        >
          <coneGeometry args={[0.0135, 0.012, 16]} />
          <Brass />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A rotary vane vacuum pump on the bench: a finned motor in grey enamel
 * bolted to the cast pump block, with the block's oil sight glass, its inlet
 * and exhaust on top, a carrying handle, and rubber feet under the base.
 */
function Pump() {
  return (
    <group position={[PUMP.x, 0, PUMP.z]}>
      <RoundedBox
        args={[0.4, 0.014, 0.17]}
        castShadow
        position={[0.07, 0.021, 0]}
        radius={0.005}
        receiveShadow
        smoothness={2}
      >
        <MetalMaterial color={CAR_COLORS.hub} roughness={0.5} />
      </RoundedBox>
      {Arr.map(
        [
          [-0.1, 0.065],
          [-0.1, -0.065],
          [0.24, 0.065],
          [0.24, -0.065],
        ] as const,
        ([x, z]) => (
          <mesh key={`${x}:${z}`} position={[x, 0.007, z]}>
            <cylinderGeometry args={[0.014, 0.016, 0.014, 16]} />
            <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.9} />
          </mesh>
        )
      )}
      <RoundedBox
        args={[0.15, 0.17, 0.15]}
        castShadow
        position={[-0.045, 0.113, 0]}
        radius={0.014}
        smoothness={3}
      >
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.enamel}
          repeat={[2, 2]}
          roughness={0.45}
          surface="paint"
        />
      </RoundedBox>
      <mesh position={[-0.045, 0.075, 0.0755]}>
        <circleGeometry args={[0.02, 32]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={BENCH_COLORS.bottleAmber}
          roughness={0.08}
        />
      </mesh>
      <mesh position={[-0.045, 0.075, 0.075]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.022, 0.004, 10, 32]} />
        <Brass />
      </mesh>
      <mesh castShadow position={[-0.07, PUMP.inlet - 0.004, 0]}>
        <cylinderGeometry args={[0.012, 0.014, 0.04, 16]} />
        <Brass />
      </mesh>
      <mesh castShadow position={[-0.012, 0.222, 0.03]}>
        <cylinderGeometry args={[0.026, 0.026, 0.05, 24]} />
        <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.35} />
      </mesh>
      <mesh
        castShadow
        position={[0.14, 0.108, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.07, 0.07, 0.22, 40]} />
        <SurfaceMaterial
          color={LABORATORY_COLORS.steel}
          repeat={[4, 2]}
          roughness={0.5}
          surface="paint"
        />
      </mesh>
      {Arr.map(Arr.range(0, 8), (fin) => (
        <mesh
          key={fin}
          position={[0.06 + fin * 0.02, 0.108, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry args={[0.071, 0.004, 8, 40]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.steel}
            metalness={0.3}
            roughness={0.5}
          />
        </mesh>
      ))}
      <mesh position={[0.256, 0.108, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={CAR_COLORS.grille} roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.19, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.055, 0.008, 12, 32, Math.PI]} />
        <meshStandardMaterial color={CAR_COLORS.grille} roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * The retort stand behind the tube: a cast base, a steel rod, and two bossed
 * clamps whose cork-lined rings hold the glass upright.
 */
function Stand() {
  return (
    <group position={[0, 0, -0.19]}>
      <RoundedBox
        args={[0.3, 0.02, 0.18]}
        castShadow
        position={[0, 0.01, 0.03]}
        radius={0.006}
        receiveShadow
        smoothness={2}
      >
        <SurfaceMaterial
          color={MACHINE_COLORS.standBlue}
          repeat={[2, 1]}
          roughness={0.5}
          surface="paint"
        />
      </RoundedBox>
      <mesh castShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.0065, 0.0065, 1.22, 16]} />
        <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.22} />
      </mesh>
      {Arr.map(CLAMPS, (height) => (
        <group key={height} position={[0, height, 0]}>
          <RoundedBox args={[0.03, 0.036, 0.03]} castShadow radius={0.005}>
            <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.4} />
          </RoundedBox>
          <mesh
            castShadow
            position={[0, 0, 0.06]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.005, 0.005, 0.1, 12]} />
            <MetalMaterial color={LABORATORY_COLORS.chrome} roughness={0.25} />
          </mesh>
          <mesh
            castShadow
            position={[0, 0, 0.19]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[TUBE.radius + 0.012, 0.006, 12, 48]} />
            <MetalMaterial color={LABORATORY_COLORS.steel} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[TUBE.radius + 0.006, 0.0035, 8, 48]} />
            <meshStandardMaterial
              color={BENCH_COLORS.stopper}
              roughness={0.9}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The whole apparatus of the guinea-and-feather experiment on its bench: the
 * capped glass tube in its stand, the tap and gauge on its side branch, and
 * the hose to the vacuum pump.
 *
 * @param children - The gauge on the branch, which the lab gives its reading
 */
export function VacuumApparatus({
  children,
}: {
  readonly children: ReactNode;
}) {
  const hose = useMemo(hoseGeometry, []);
  useEffect(() => () => hose.dispose(), [hose]);

  return (
    <group>
      <group position={[0.35, 0, 0]}>
        <Bench />
      </group>
      <Stand />
      <CappedTube />
      <Branch>{children}</Branch>
      <mesh castShadow geometry={hose} receiveShadow>
        <SurfaceMaterial
          color={LABORATORY_COLORS.tubing}
          repeat={[1, 24]}
          roughness={0.8}
          surface="rubber"
        />
      </mesh>
      <Pump />
    </group>
  );
}
