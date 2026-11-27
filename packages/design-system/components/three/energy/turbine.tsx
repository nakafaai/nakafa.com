import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { bladeGeometry } from "@repo/design-system/components/three/energy/blade";
import {
  NACELLE,
  nacelleGeometry,
} from "@repo/design-system/components/three/energy/nacelle";
import {
  ROTOR,
  rotorRate,
  spinnerProfile,
} from "@repo/design-system/components/three/energy/rotor";
import {
  towerProfile,
  towerRadius,
} from "@repo/design-system/components/three/energy/tower";
import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { LatheGeometry, Vector2 } from "three";

/** The height of the concrete foundation that shows above the ground, for a rotor of radius 1. */
const PLINTH = 0.02;

/** Where the tower ends under the nacelle's yaw bearing. */
const TOWER_TOP = ROTOR.hub - NACELLE.tall - 0.012;

/** The tower's radius at its foot and under the nacelle: 4.2 m and 2.5 m for an 80 m rotor. */
const FOOT_RADIUS = 0.052;
const TOP_RADIUS = 0.031;

/** How far upwind of the tower's axis the nacelle's front face stands. */
const NACELLE_FRONT = 0.085;

/** The spinner's radius and the length of its nose. */
const SPINNER = [0.052, 0.085] as const;

/** Where a blade's root starts, from the rotor's axis. */
const ROOT = 0.034;

/** The three blades, a third of a turn apart. */
const BLADE_TURNS = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3] as const;

/** The fins of the cooler on the nacelle's roof. */
const FINS: readonly Placement[] = Arr.makeBy(11, (fin) => ({
  position: [-0.03 + fin * 0.006, 0, 0],
}));

/** The treads of the stair to the tower's door. */
const TREADS: readonly Placement[] = Arr.makeBy(4, (tread) => ({
  position: [0, 0.006 + tread * 0.007, 0.03 - tread * 0.008],
}));

/** The cups of the anemometer, a third of a turn apart. */
const CUPS: readonly Placement[] = Arr.map(BLADE_TURNS, (turn) => ({
  position: [Math.cos(turn) * 0.011, 0, Math.sin(turn) * 0.011],
  rotation: [0, -turn, 0],
}));

/** The turbine's white gel coat on a part whose texture runs `across` by `along` tiles. */
function Coat({
  across,
  along,
}: {
  readonly across: number;
  readonly along: number;
}) {
  return (
    <SurfaceMaterial
      coat={0.25}
      color={MACHINE_COLORS.turbineWhite}
      repeat={[across, along]}
      surface="paint"
    />
  );
}

/** The galvanised steel of the stair, the rails and the masts. */
function Galvanised() {
  return (
    <SurfaceMaterial
      color={MACHINE_COLORS.galvanised}
      metalness={1}
      roughness={0.7}
      surface="brushed"
    />
  );
}

/** The dark machined steel of the bearings and the door's frame. */
function Machined() {
  return (
    <SurfaceMaterial color={CAR_COLORS.hub} metalness={1} surface="brushed" />
  );
}

/** The tower on its foundation, with the door, its stair and its landing. */
function Tower() {
  const shell = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(
          towerProfile(TOWER_TOP - PLINTH, FOOT_RADIUS, TOP_RADIUS),
          ([radius, height]) => new Vector2(radius, height)
        ),
        64
      ),
    []
  );
  useEffect(() => () => shell.dispose(), [shell]);
  const doorRadius = towerRadius(FOOT_RADIUS, TOP_RADIUS, 0.03);

  return (
    <group>
      <mesh castShadow position={[0, PLINTH / 2, 0]} receiveShadow>
        <cylinderGeometry args={[0.105, 0.115, PLINTH, 64]} />
        <SurfaceMaterial
          color={MACHINE_COLORS.concrete}
          repeat={[6, 1]}
          surface="concrete"
        />
      </mesh>
      <mesh castShadow geometry={shell} position={[0, PLINTH, 0]} receiveShadow>
        <Coat across={3} along={24} />
      </mesh>
      <group position={[0, PLINTH, doorRadius]}>
        <RoundedBox
          args={[0.024, 0.052, 0.006]}
          position={[0, 0.062, -0.001]}
          radius={0.002}
          smoothness={3}
        >
          <Coat across={1} along={1} />
        </RoundedBox>
        <RoundedBox
          args={[0.03, 0.058, 0.004]}
          position={[0, 0.062, -0.003]}
          radius={0.002}
          smoothness={3}
        >
          <Machined />
        </RoundedBox>
        <mesh castShadow position={[0, 0.033, 0.014]} receiveShadow>
          <boxGeometry args={[0.04, 0.003, 0.028]} />
          <Galvanised />
        </mesh>
        <Repeat placements={TREADS}>
          <boxGeometry args={[0.03, 0.0015, 0.009]} />
          <Galvanised />
        </Repeat>
        {Arr.map([-0.019, 0.019], (x) => (
          <group key={x}>
            <mesh castShadow position={[x, 0.047, 0.027]}>
              <cylinderGeometry args={[0.0012, 0.0012, 0.028, 8]} />
              <Galvanised />
            </mesh>
            <mesh
              castShadow
              position={[x, 0.061, 0.014]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.0012, 0.0012, 0.028, 8]} />
              <Galvanised />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** The nacelle on its yaw bearing, with the cooler, the weather mast and the aviation light on its roof. */
function Nacelle({ wind }: { readonly wind: number }) {
  const shell = useMemo(() => nacelleGeometry(), []);
  useEffect(() => () => shell.dispose(), [shell]);
  const cups = useRef<Group>(null);
  const playing = useVisualScene((card) => card.playing, true);
  useFrame((_, delta) => {
    if (playing && cups.current) {
      cups.current.rotation.y += simulationStep(delta) * wind * 1.6;
    }
  });

  return (
    <group position={[0, ROTOR.hub, 0]}>
      <mesh castShadow position={[0, -NACELLE.tall - 0.005, 0]}>
        <cylinderGeometry
          args={[TOP_RADIUS * 1.12, TOP_RADIUS * 1.12, 0.014, 48]}
        />
        <Machined />
      </mesh>
      <mesh
        castShadow
        geometry={shell}
        position={[0, 0, NACELLE_FRONT]}
        receiveShadow
      >
        <Coat across={4} along={4} />
      </mesh>
      <group position={[0, NACELLE.tall + 0.01, -0.15]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.022, 0.012]} />
          <Machined />
        </mesh>
        <group position={[0, 0, 0.007]}>
          <Repeat placements={FINS}>
            <boxGeometry args={[0.0012, 0.02, 0.004]} />
            <Galvanised />
          </Repeat>
        </group>
      </group>
      <group position={[0.02, NACELLE.tall - 0.004, -0.19]}>
        <mesh castShadow position={[0, 0.022, 0]}>
          <cylinderGeometry args={[0.0014, 0.0014, 0.044, 8]} />
          <Galvanised />
        </mesh>
        <group position={[0, 0.045, 0]} ref={cups}>
          <Repeat placements={CUPS}>
            <sphereGeometry args={[0.0042, 12, 8, 0, Math.PI, 0, Math.PI]} />
            <SurfaceMaterial color={CAR_COLORS.hub} surface="plastic" />
          </Repeat>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0008, 0.0008, 0.022, 6]} />
            <Galvanised />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, (2 * Math.PI) / 3]}>
            <cylinderGeometry args={[0.0008, 0.0008, 0.022, 6]} />
            <Galvanised />
          </mesh>
        </group>
      </group>
      <group position={[-0.02, NACELLE.tall - 0.004, -0.19]}>
        <mesh position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.003, 0.0036, 0.016, 12]} />
          <Galvanised />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <sphereGeometry args={[0.0046, 16, 12]} />
          <meshStandardMaterial
            color={MACHINE_COLORS.signalRed}
            emissive={MACHINE_COLORS.signalRed}
            emissiveIntensity={1.4}
            roughness={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}

/** The spinner and the three blades on their pitch bearings, turning at the rate the wind gives them. */
function Rotor({ rate }: { readonly rate: number }) {
  const rotor = useRef<Group>(null);
  const playing = useVisualScene((card) => card.playing, true);
  const blade = useMemo(() => bladeGeometry(1 - ROOT), []);
  const spinner = useMemo(
    () =>
      new LatheGeometry(
        Arr.map(
          spinnerProfile(SPINNER[0], SPINNER[1]),
          ([radius, height]) => new Vector2(radius, height)
        ),
        48
      ),
    []
  );
  useEffect(
    () => () => {
      blade.dispose();
      spinner.dispose();
    },
    [blade, spinner]
  );
  useVisualStop(() => {
    if (rotor.current) {
      rotor.current.rotation.z = 0;
    }
  });
  useFrame((_, delta) => {
    if (playing && rotor.current) {
      rotor.current.rotation.z -= simulationStep(delta) * rate;
    }
  });

  return (
    <group position={[0, ROTOR.hub, ROTOR.overhang]} ref={rotor}>
      <mesh castShadow geometry={spinner} rotation={[Math.PI / 2, 0, 0]}>
        <Coat across={2} along={1} />
      </mesh>
      {Arr.map(BLADE_TURNS, (turn) => (
        <group key={turn} rotation={[0, 0, turn]}>
          <mesh castShadow geometry={blade} position={[0, ROOT, 0]}>
            <Coat across={1} along={10} />
          </mesh>
          <mesh castShadow position={[0, ROOT + 0.012, 0]}>
            <cylinderGeometry args={[0.0268, 0.0268, 0.02, 32]} />
            <Machined />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A three-bladed utility wind turbine in a steady wind, as it stands on a
 * site: lofted aerofoil blades with their twist, taper and prebend on
 * pitch bearings round a spinner, a glass-fibre nacelle with its cooler,
 * anemometer and aviation light, and a tapered steel tower of flanged
 * sections with its door and stair on a concrete foundation. The author
 * names the wind and the rotor's real size, and the rotor turns at the rate
 * that wind gives it, clockwise seen from upwind. The turbine stands on the
 * origin with its rotor facing +z, where the wind comes from, and stops
 * with the card's Play control.
 *
 * @param radius - The rotor's radius, in scene units
 * @param metres - The rotor's real radius, in metres
 * @param wind - The wind speed, in metres per second
 */
/** The room the turbine takes while its rotor turns, in rotor radii: a camera frames this, not where the blades stand at one moment. */
const ENVELOPE = {
  x: { max: 1, min: -1 },
  y: { max: ROTOR.hub + 1, min: 0 },
  z: { max: 0.22, min: -0.3 },
} as const;

export function Turbine({
  metres,
  radius,
  wind,
}: {
  readonly metres: number;
  readonly radius: number;
  readonly wind: number;
}) {
  return (
    <group scale={radius}>
      <CameraBounds bounds={ENVELOPE}>
        <Tower />
        <Nacelle wind={wind} />
        <Rotor rate={rotorRate(wind, metres)} />
      </CameraBounds>
    </group>
  );
}
