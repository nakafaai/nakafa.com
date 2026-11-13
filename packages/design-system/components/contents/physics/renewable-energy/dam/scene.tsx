import { useFrame } from "@react-three/fiber";
import {
  HEAD,
  inletSpeed,
  stagePowers,
  waterPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/dam/chain";
import {
  Parcels,
  Pipe,
  useSceneTime,
} from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import { ExtrudeGeometry, type Group, Shape } from "three";

/** Scene units per metre: the valley is drawn at one unit to ten metres. */
const SCALE = 0.1;

/** The dam's crest, in metres above the riverbed. */
const CREST = 108;

/** How tall the stage bars stand for the most power this dam can release, in scene units. */
const BAR_TALL = 5;

/** The stages in the order energy passes through them. */
const STAGES = ["potential", "kinetic", "shaft", "electric"] as const;

/** The concrete wall in profile: a steep upstream face and a sloping downstream face. */
function useWall() {
  return useMemo(() => {
    const profile = new Shape();
    profile.moveTo(-2.3, 0);
    profile.lineTo(-2.3, CREST * SCALE);
    profile.lineTo(-1.7, CREST * SCALE);
    profile.lineTo(0.8, 0);
    profile.closePath();
    const wall = new ExtrudeGeometry(profile, {
      bevelEnabled: false,
      depth: 12,
    });
    wall.translate(0, 0, -6);
    return wall;
  }, []);
}

/**
 * A hydropower dam in a green valley, drawn at one unit to ten metres. The
 * reservoir stands at the chosen head behind the concrete wall, water races
 * down the penstock to the powerhouse, its runner turns as fast as the water
 * arrives, and four bars beside the river show each stage's power.
 */
export function DamScene({
  colors,
  head,
}: {
  readonly colors: Record<(typeof STAGES)[number], string>;
  readonly head: number;
}) {
  const wall = useWall();
  const time = useSceneTime();
  const runner = useRef<Group>(null);
  const pace = inletSpeed(head) / inletSpeed(HEAD.max);
  const stages = stagePowers(head);
  const level = head * SCALE;

  useFrame(() => {
    runner.current?.rotation.set(0, 0, -time.current * 6 * pace);
  });

  return (
    <group>
      <mesh position={[-8.2, level / 2, 0]}>
        <boxGeometry args={[11.8, level, 12]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={MATERIAL.water}
          metalness={0.1}
          opacity={0.92}
          roughness={0.15}
          transparent
        />
      </mesh>
      <mesh castShadow geometry={wall} receiveShadow>
        <meshStandardMaterial color={MATERIAL.concrete} roughness={0.85} />
      </mesh>
      <mesh position={[-4, 4, -10]} receiveShadow scale={[14, 6, 4]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshStandardMaterial color={MATERIAL.foliageDark} roughness={1} />
      </mesh>
      <Pipe from={[-2.4, 1.4, 3]} radius={0.28} to={[2.4, 0.5, 3]}>
        <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.5} />
      </Pipe>
      <Parcels
        color={MATERIAL.waterGlint}
        count={8}
        from={[-2.4, 1.4, 3.32]}
        pace={0.25 + 0.6 * pace}
        size={0.09}
        to={[2.4, 0.5, 3.32]}
      />
      <mesh castShadow position={[3.6, 0.85, 3]} receiveShadow>
        <boxGeometry args={[2.6, 1.7, 2.6]} />
        <meshStandardMaterial color={MATERIAL.concrete} roughness={0.8} />
      </mesh>
      <group position={[3.6, 0.85, 4.32]} ref={runner}>
        {Arr.map(Arr.range(0, 7), (blade) => (
          <mesh key={blade} rotation={[0, 0, (blade * Math.PI) / 4]}>
            <boxGeometry args={[1.1, 0.12, 0.08]} />
            <MetalMaterial color={MATERIAL.brass} roughness={0.35} />
          </mesh>
        ))}
      </group>
      <mesh position={[8, 0.04, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 5]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={MATERIAL.water}
          roughness={0.1}
        />
      </mesh>
      {Arr.map(STAGES, (stage, index) => {
        const tall = Math.max(
          (stages[stage] / waterPower(HEAD.max)) * BAR_TALL,
          0.02
        );
        return (
          <mesh
            castShadow
            key={stage}
            position={[6.5 + index * 0.8, tall / 2, -3.5]}
          >
            <boxGeometry args={[0.55, tall, 0.55]} />
            <meshStandardMaterial
              color={colors[stage]}
              emissive={colors[stage]}
              emissiveIntensity={0.25}
            />
          </mesh>
        );
      })}
    </group>
  );
}
