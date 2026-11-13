import { useFrame } from "@react-three/fiber";
import {
  ROTOR_RADIUS,
  rotorSpeed,
  SITE_WIND,
  type Site,
} from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import { useSceneTime } from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group, Mesh } from "three";

/** Scene units per metre: the turbine is drawn at one unit to ten metres. */
const SCALE = 0.1;

/** The hub's height above the ground it stands on, in metres. */
const HUB_HEIGHT = 80;

/** How high each site lifts the turbine's foot, in scene units. */
const SITE_RISE = { coast: 0, hill: 3, valley: 0 } as const satisfies Record<
  Site,
  number
>;

/** The land of each site: a valley between two ridges, a round hill, or a beach by the sea. */
function Land({ site }: { readonly site: Site }) {
  if (site === "coast") {
    return (
      <group>
        <mesh
          position={[0, 0.01, 18]}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[80, 30]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={MATERIAL.water}
            roughness={0.15}
          />
        </mesh>
        <mesh
          position={[0, 0.02, 2]}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[80, 6]} />
          <meshStandardMaterial color={MATERIAL.sand} roughness={1} />
        </mesh>
      </group>
    );
  }
  if (site === "hill") {
    return (
      <mesh position={[0, 0, 0]} receiveShadow scale={[14, SITE_RISE.hill, 14]}>
        <sphereGeometry args={[1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={MATERIAL.grass} roughness={1} />
      </mesh>
    );
  }
  return (
    <group>
      {Arr.map([-1, 1] as const, (side) => (
        <mesh
          key={side}
          position={[side * 16, 0, -6]}
          receiveShadow
          scale={[12, 9, 14]}
        >
          <sphereGeometry args={[1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={MATERIAL.foliageDark} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One wind turbine at the chosen site, drawn at one unit to ten metres, its
 * three blades turning at the true speed the site's wind gives them, with
 * streaks of moving air crossing the scene at that wind.
 */
export function WindScene({ site }: { readonly site: Site }) {
  const playing = useVisualScene((card) => card.playing, false);
  const time = useSceneTime();
  const rotor = useRef<Group>(null);
  const turn = useRef(0);
  const streaks = useRef<(Mesh | null)[]>([]);
  const foot = SITE_RISE[site];
  const hub = foot + HUB_HEIGHT * SCALE;
  const blade = ROTOR_RADIUS * SCALE;

  useFrame((_, delta) => {
    if (playing) {
      turn.current += Math.min(delta, 0.1) * rotorSpeed(site);
    }
    rotor.current?.rotation.set(0, 0, -turn.current);
    Arr.forEach(streaks.current, (streak, index) => {
      if (!streak) {
        return;
      }
      const lane = (index * 0.618) % 1;
      const x =
        ((time.current * SITE_WIND[site] * SCALE + lane * 60) % 60) - 30;
      streak.position.set(x, 2 + lane * hub * 1.2, -4 + (index % 3) * 4);
    });
  });

  return (
    <group>
      <Land site={site} />
      <mesh castShadow position={[0, foot + (HUB_HEIGHT * SCALE) / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.32, HUB_HEIGHT * SCALE, 24]} />
        <meshStandardMaterial color={MATERIAL.turbineWhite} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, hub, -0.35]}>
        <boxGeometry args={[0.5, 0.5, 1.4]} />
        <meshStandardMaterial color={MATERIAL.turbineWhite} roughness={0.45} />
      </mesh>
      <group position={[0, hub, 0.45]} ref={rotor}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.28, 0.6, 24]} />
          <meshStandardMaterial color={MATERIAL.turbineWhite} roughness={0.4} />
        </mesh>
        {Arr.map(Arr.range(0, 2), (index) => (
          <mesh
            castShadow
            key={index}
            position={[
              Math.cos((index * 2 * Math.PI) / 3) * blade * 0.5,
              Math.sin((index * 2 * Math.PI) / 3) * blade * 0.5,
              0,
            ]}
            rotation={[0, 0, (index * 2 * Math.PI) / 3 - Math.PI / 2]}
          >
            <boxGeometry args={[0.22, blade, 0.05]} />
            <meshStandardMaterial
              color={MATERIAL.turbineWhite}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>
      {Arr.map(Arr.range(0, 11), (index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            streaks.current[index] = mesh;
          }}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry
            args={[0.02, 0.02, 0.4 + SITE_WIND[site] * 0.25, 6]}
          />
          <meshBasicMaterial color={MATERIAL.cloud} opacity={0.6} transparent />
        </mesh>
      ))}
    </group>
  );
}
