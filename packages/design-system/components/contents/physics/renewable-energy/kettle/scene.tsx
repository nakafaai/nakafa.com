import { useFrame } from "@react-three/fiber";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { advanceRun } from "@repo/design-system/components/contents/physics/canvas/clock";
import { mix } from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  BOILING_POINT,
  boilTime,
  FILL_MASS,
  type Fill,
  START_TEMPERATURE,
  TEMPERATURE_RISE,
  waterTemperature,
} from "@repo/design-system/components/contents/physics/renewable-energy/kettle/heating";
import { Puffs } from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useRef, useState } from "react";
import type {
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

/** How many seconds a whole heating plays in, sped up from minutes. */
const PLAY_SECONDS = 7;

/** How long the boiling kettle rests before the run starts again, in seconds. */
const HOLD_SECONDS = 2;

/** The kettle's inner radius and the height a litre of water fills, in metres. */
const RADIUS = 0.075;
const LITRE_HEIGHT = 1 / (1000 * Math.PI * RADIUS * RADIUS);

/** The thermometer's column at 100 °C, in metres. */
const COLUMN = 0.18;

/**
 * A glass kettle of water on its base beside a thermometer. The water warms
 * from 25 °C at the rate the 2100 W element delivers energy, its tint turning
 * warm, bubbles rising faster, and steam leaving the spout at the boil.
 */
export function KettleScene({ fill }: { readonly fill: Fill }) {
  const playing = useVisualScene((card) => card.playing, false);
  const run = useRef(0);
  const shown = useRef<Fill | undefined>(undefined);
  const water = useRef<MeshPhysicalMaterial>(null);
  const ring = useRef<MeshStandardMaterial>(null);
  const column = useRef<Mesh>(null);
  const bubbles = useRef<Group>(null);
  const [boiling, setBoiling] = useState(false);
  const level = FILL_MASS[fill] * LITRE_HEIGHT;

  useFrame((_, delta) => {
    const duration = boilTime(fill);
    if (shown.current !== fill) {
      shown.current = fill;
      run.current = 0;
    }
    if (playing) {
      run.current = advanceRun(run.current, delta, {
        duration,
        hold: HOLD_SECONDS,
        rate: duration / PLAY_SECONDS,
      });
    }
    const temperature = waterTemperature(fill, Math.min(run.current, duration));
    const warm = (temperature - START_TEMPERATURE) / TEMPERATURE_RISE;
    water.current?.color.set(
      mix(MATERIAL.kettleWater, MATERIAL.warmWater, warm)
    );
    if (ring.current) {
      ring.current.emissiveIntensity = 0.4 + warm * 2;
    }
    column.current?.scale.set(
      1,
      Math.max(temperature / BOILING_POINT, 0.01),
      1
    );
    column.current?.position.set(
      0.17,
      0.03 + (COLUMN * temperature) / BOILING_POINT / 2,
      0
    );
    Arr.forEach(bubbles.current?.children ?? [], (bubble, index) => {
      const pace = 0.15 + warm * warm * 0.9;
      const rise = (run.current * pace * 0.2 + index * 0.137) % 1;
      bubble.position.y = 0.045 + rise * level;
      bubble.visible = warm > 0.3 && index < warm * warm * 24;
    });
    const atBoil = temperature >= BOILING_POINT - 0.5;
    if (atBoil !== boiling) {
      setBoiling(atBoil);
    }
  });

  return (
    <group>
      <LabBench width={1.2} />
      <group position={[-0.05, 0, 0]}>
        <mesh castShadow position={[0, 0.015, 0]} receiveShadow>
          <cylinderGeometry args={[0.1, 0.105, 0.03, 40]} />
          <meshStandardMaterial color={getColor("ZINC", 950)} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.032, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.065, 40]} />
          <meshStandardMaterial
            color={MATERIAL.coalGlow}
            emissive={MATERIAL.coalGlow}
            ref={ring}
          />
        </mesh>
        <mesh position={[0, 0.035 + 0.11, 0]}>
          <cylinderGeometry
            args={[RADIUS + 0.004, RADIUS + 0.008, 0.22, 48, 1, true]}
          />
          <GlassMaterial color={MATERIAL.glass} />
        </mesh>
        <mesh position={[0, 0.035 + level / 2, 0]}>
          <cylinderGeometry args={[RADIUS, RADIUS, level, 48]} />
          <meshPhysicalMaterial
            attach="material"
            clearcoat={0.6}
            color={MATERIAL.kettleWater}
            depthWrite={false}
            opacity={0.66}
            ref={water}
            roughness={0.12}
            transparent
          />
        </mesh>
        <mesh position={[0, 0.258, 0]}>
          <cylinderGeometry args={[RADIUS + 0.01, RADIUS + 0.01, 0.015, 40]} />
          <meshStandardMaterial color={getColor("ZINC", 900)} roughness={0.5} />
        </mesh>
        <mesh position={[RADIUS + 0.04, 0.14, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.055, 0.012, 12, 24, Math.PI]} />
          <meshStandardMaterial color={getColor("ZINC", 900)} roughness={0.5} />
        </mesh>
        <group ref={bubbles}>
          {Arr.map(Arr.range(0, 23), (index) => (
            <mesh
              key={index}
              position={[
                Math.sin(index * 2.4) * RADIUS * 0.7,
                0.05,
                Math.cos(index * 2.4) * RADIUS * 0.7,
              ]}
            >
              <sphereGeometry args={[0.003 + (index % 3) * 0.0015, 8, 6]} />
              <meshStandardMaterial
                color={getColor("WHITE")}
                opacity={0.7}
                transparent
              />
            </mesh>
          ))}
        </group>
        <Puffs
          amount={boiling ? 1 : 0}
          at={[-RADIUS, 0.27, 0]}
          rise={0.35}
          size={0.04}
        />
      </group>
      <group>
        <mesh position={[0.17, 0.12, 0]}>
          <cylinderGeometry args={[0.009, 0.009, 0.22, 16]} />
          <GlassMaterial color={MATERIAL.glass} opacity={0.4} />
        </mesh>
        <mesh position={[0.17, 0.02, 0]}>
          <sphereGeometry args={[0.014, 16, 12]} />
          <MetalMaterial color={MATERIAL.mercury} roughness={0.15} />
        </mesh>
        <mesh position={[0.17, 0.03, 0]} ref={column}>
          <cylinderGeometry args={[0.004, 0.004, COLUMN, 12]} />
          <MetalMaterial color={MATERIAL.mercury} roughness={0.15} />
        </mesh>
      </group>
    </group>
  );
}
