import { useFrame } from "@react-three/fiber";
import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  type Bulb,
  heatPower,
  INPUT_POWER,
  lightPower,
  RUN_TIME,
} from "@repo/design-system/components/contents/physics/renewable-energy/flashlight/bulb";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useRef, useState } from "react";
import type { Mesh } from "three";

/** How many seconds the 7.5 h of battery life plays in. */
const PLAY_SECONDS = 8;

/** How long the flat battery rests before it is swapped for a fresh one, in seconds. */
const HOLD_SECONDS = 1;

/** The glow of each bulb: a filament burns warm, an LED white. */
const BULB_GLOW = {
  filament: MATERIAL.filamentGlow,
  led: MATERIAL.ledGlow,
} as const satisfies Record<Bulb, string>;

/** How far the wall stands from the lens, in metres. */
const THROW = 0.9;

/**
 * A flashlight on a board, its body cut away to show its two cells draining
 * as the battery's hours pass, sped up. The beam and the spot on the wall are
 * as bright as the light the bulb gives; a warm haze around the head is as
 * strong as the heat it gives.
 */
export function FlashlightScene({
  bulb,
  heatColor,
}: {
  readonly bulb: Bulb;
  readonly heatColor: string;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const run = useRef(0);
  const cells = useRef<(Mesh | null)[]>([]);
  const [lit, setLit] = useState(true);
  const light = lightPower(bulb) / lightPower("led");
  const heat = heatPower(bulb) / INPUT_POWER;
  const glow = BULB_GLOW[bulb];

  useFrame((_, delta) => {
    if (playing) {
      run.current = advanceRun(run.current, delta, {
        duration: RUN_TIME,
        hold: HOLD_SECONDS,
        rate: RUN_TIME / PLAY_SECONDS,
      });
    }
    const charge = Math.max(1 - run.current / RUN_TIME, 0);
    Arr.forEach(cells.current, (cell) => {
      cell?.scale.set(1, Math.max(charge, 0.02), 1);
    });
    const on = run.current < RUN_TIME;
    if (on !== lit) {
      setLit(on);
    }
  });

  return (
    <group>
      <mesh position={[0.3, -0.01, 0]} receiveShadow>
        <boxGeometry args={[1.6, 0.02, 0.5]} />
        <meshStandardMaterial color={MATERIAL.crateWood} roughness={0.7} />
      </mesh>
      <group position={[-0.1, 0.03, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.2, 32, 1, true]} />
          <GlassMaterial color={MATERIAL.glass} opacity={0.3} />
        </mesh>
        {Arr.map([-0.045, 0.045] as const, (offset, index) => (
          <group key={offset} position={[0, offset, 0]}>
            <mesh>
              <cylinderGeometry args={[0.0145, 0.0145, 0.085, 24]} />
              <meshStandardMaterial color={MATERIAL.battery} roughness={0.5} />
            </mesh>
            <mesh
              position={[0, -0.0425, 0]}
              ref={(mesh) => {
                cells.current[index] = mesh;
              }}
            >
              <cylinderGeometry args={[0.0148, 0.0148, 0.085, 24]} />
              <meshStandardMaterial
                color={MATERIAL.batteryTerminal}
                opacity={0.55}
                transparent
              />
            </mesh>
          </group>
        ))}
        <mesh castShadow position={[0, 0.125, 0]}>
          <cylinderGeometry args={[0.034, 0.024, 0.05, 32]} />
          <MetalMaterial color={MATERIAL.chrome} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.151, 0]}>
          <circleGeometry args={[0.032, 32]} />
          <meshStandardMaterial
            color={glow}
            emissive={glow}
            emissiveIntensity={lit ? 1 + light * 4 : 0}
          />
        </mesh>
      </group>
      {lit ? (
        <group>
          <mesh
            position={[0.055 + THROW / 2, 0.03, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <coneGeometry args={[0.16, THROW, 40, 1, true]} />
            <meshBasicMaterial
              color={glow}
              depthWrite={false}
              opacity={0.04 + 0.16 * light}
              transparent
            />
          </mesh>
          <mesh position={[0.055, 0.03, 0]}>
            <sphereGeometry args={[0.05 + heat * 0.05, 24, 16]} />
            <meshBasicMaterial
              color={heatColor}
              depthWrite={false}
              opacity={0.12 + 0.25 * heat}
              transparent
            />
          </mesh>
        </group>
      ) : null}
      <mesh position={[0.06 + THROW, 0.25, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.9, 0.55]} />
        <meshStandardMaterial color={MATERIAL.wallPlaster} roughness={0.95} />
      </mesh>
      {lit ? (
        <mesh
          position={[0.055 + THROW, 0.03, 0]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <circleGeometry args={[0.15, 40]} />
          <meshBasicMaterial
            color={glow}
            depthWrite={false}
            opacity={0.15 + 0.6 * light}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  );
}
