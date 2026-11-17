import { RoundedBox } from "@react-three/drei";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { DoubleSide, PlaneGeometry, SpotLight } from "three";

/**
 * The tank, in metres: 60 cm long, 35 cm deep and 35 cm high, of 6 mm
 * rimless glass, its water 30 cm deep.
 */
export const TANK = {
  depth: 0.35,
  glass: 0.006,
  height: 0.35,
  length: 0.6,
  water: 0.3,
} as const;

/**
 * The reef light: a slim LED bar 44 cm long and 7.5 cm deep, standing 3 cm
 * above the glass on brackets that rest on the side panes.
 */
const FIXTURE = { above: 0.03, depth: 0.075, length: 0.44, thick: 0.014 };

/**
 * The tank's glass. Seen from the front, clear glass shows only where it
 * reflects, which a lab's bright windows would wash over the corals, so the
 * front and back panes are drawn by their edges alone, green as thick glass
 * shows end on, and the side panes, seen at a slant, in full. The back pane
 * wears the black film most reef tanks do, against which the corals stand
 * out.
 */
export function TankGlass() {
  const { depth, glass, height, length } = TANK;
  const panes = [
    ["left", [-length / 2, height / 2, 0]],
    ["right", [length / 2, height / 2, 0]],
  ] as const;
  const edges = [
    [
      "front-left",
      [-length / 2, height / 2, depth / 2],
      [glass, height, glass],
    ],
    [
      "front-right",
      [length / 2, height / 2, depth / 2],
      [glass, height, glass],
    ],
    [
      "back-left",
      [-length / 2, height / 2, -depth / 2],
      [glass, height, glass],
    ],
    [
      "back-right",
      [length / 2, height / 2, -depth / 2],
      [glass, height, glass],
    ],
    ["top-front", [0, height, depth / 2], [length, glass, glass]],
    ["top-back", [0, height, -depth / 2], [length, glass, glass]],
    ["top-left", [-length / 2, height, 0], [glass, glass, depth]],
    ["top-right", [length / 2, height, 0], [glass, glass, depth]],
    ["foot-front", [0, glass / 2, depth / 2], [length, glass, glass]],
  ] as const;
  return (
    <group>
      {Arr.map(panes, ([name, position]) => (
        <mesh key={name} position={position}>
          <boxGeometry args={[glass, height, depth]} />
          <GlassMaterial color={BENCH_COLORS.glass} opacity={0.1} />
        </mesh>
      ))}
      {Arr.map(edges, ([name, position, size]) => (
        <mesh key={name} position={position}>
          <boxGeometry
            args={[size[0] * 1.04, size[1] * 1.04, size[2] * 1.04]}
          />
          <GlassMaterial color={BENCH_COLORS.glassEdge} opacity={0.35} />
        </mesh>
      ))}
      <mesh position={[0, height / 2, -depth / 2 - glass / 2 - 0.0006]}>
        <planeGeometry args={[length, height]} />
        <meshStandardMaterial
          color={ECOLOGY_COLORS.tankBackdrop}
          envMapIntensity={0.12}
          roughness={1}
        />
      </mesh>
    </group>
  );
}

/**
 * The water's surface, stirred into faint ripples by the pump, so it catches
 * the light from above and mirrors the tank from below.
 */
export function WaterSurface() {
  const geometry = useMemo(() => {
    const surface = new PlaneGeometry(
      TANK.length - TANK.glass * 2,
      TANK.depth - TANK.glass * 2,
      60,
      36
    );
    surface.rotateX(-Math.PI / 2);
    const position = surface.getAttribute("position");
    for (const index of Arr.range(0, position.count - 1)) {
      const ripple =
        valueNoise(position.getX(index) * 40, position.getZ(index) * 40, 64) -
        0.5;
      position.setY(index, ripple * 0.0012);
    }
    surface.computeVertexNormals();
    return surface;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[0, TANK.water, 0]}>
      <meshPhysicalMaterial
        color={ECOLOGY_COLORS.reefWater}
        depthWrite={false}
        ior={1.33}
        opacity={0.22}
        roughness={0.1}
        side={DoubleSide}
        transparent
      />
    </mesh>
  );
}

/**
 * The reef light: an LED bar on brackets over the tank, its lens glowing,
 * shining a cool 12 000 K white straight down through the water. Its light
 * casts the corals' soft shadows on the sand.
 * A bar of LEDs as long as the tank is no point source, so its light does
 * not fall off with the square of the distance as a bulb's would: it lights
 * the water just under it and the sand 30 cm below alike, which `decay` 0
 * gives.
 */
export function ReefLight() {
  const level = TANK.height + FIXTURE.above;
  const light = useMemo(() => {
    const spot = new SpotLight(ECOLOGY_COLORS.reefLight, 2.5, 0, 0.92, 0.55, 0);
    spot.position.set(0, level - FIXTURE.thick / 2 - 0.004, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 0.02;
    spot.shadow.camera.far = 0.7;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.008;
    spot.shadow.radius = 6;
    return spot;
  }, [level]);
  useEffect(
    () => () => {
      light.dispose();
    },
    [light]
  );
  const rail = (TANK.length - FIXTURE.length) / 2 + 0.006;
  return (
    <group>
      <primitive object={light} />
      <primitive object={light.target} />
      <RoundedBox
        args={[FIXTURE.length, FIXTURE.thick, FIXTURE.depth]}
        castShadow
        position={[0, level, 0]}
        radius={0.004}
      >
        <meshPhysicalMaterial
          color={MACHINE_COLORS.signalHousing}
          metalness={0.6}
          roughness={0.38}
        />
      </RoundedBox>
      <mesh
        position={[0, level - FIXTURE.thick / 2 - 0.0004, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[FIXTURE.length - 0.02, FIXTURE.depth - 0.018]} />
        <meshStandardMaterial
          color={ENERGY_COLORS.ledGlow}
          emissive={ECOLOGY_COLORS.reefLight}
          emissiveIntensity={1.4}
        />
      </mesh>
      {Arr.map([-1, 1], (side) => (
        <group key={side}>
          <mesh
            castShadow
            position={[
              side * (FIXTURE.length / 2 + rail / 2 - 0.003),
              level,
              0,
            ]}
          >
            <boxGeometry args={[rail, 0.004, 0.014]} />
            <MetalMaterial color={INSTRUMENT_COLORS.aluminium} />
          </mesh>
          <mesh
            castShadow
            position={[side * (TANK.length / 2), (level + TANK.height) / 2, 0]}
          >
            <boxGeometry args={[0.004, level - TANK.height, 0.014]} />
            <MetalMaterial color={INSTRUMENT_COLORS.aluminium} />
          </mesh>
          {Arr.map([-1, 1], (face) => (
            <mesh
              castShadow
              key={face}
              position={[
                side * (TANK.length / 2) + face * (TANK.glass / 2 + 0.0012),
                TANK.height - 0.006,
                0,
              ]}
            >
              <boxGeometry args={[0.0024, 0.016, 0.014]} />
              <MetalMaterial color={INSTRUMENT_COLORS.aluminium} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
