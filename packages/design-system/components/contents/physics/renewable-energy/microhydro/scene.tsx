import {
  HEAD,
  HOMES,
  homesLit,
} from "@repo/design-system/components/contents/physics/renewable-energy/microhydro/stream";
import {
  House,
  Parcels,
  Pipe,
} from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

/** Scene units per metre of head. */
const SCALE = 0.4;

/** How far the slope runs out from the intake to the powerhouse, in scene units. */
const RUN = 9;

/** The hillside in profile for a head, extruded across the valley. */
function useHillside(head: number) {
  return useMemo(() => {
    const drop = head * SCALE;
    const profile = new Shape();
    profile.moveTo(-RUN - 4, 0);
    profile.lineTo(-RUN - 4, drop + 0.6);
    profile.lineTo(-RUN, drop + 0.6);
    profile.lineTo(0.5, 0);
    profile.closePath();
    const hill = new ExtrudeGeometry(profile, {
      bevelEnabled: false,
      depth: 10,
    });
    hill.translate(0, 0, -5);
    return hill;
  }, [head]);
}

/**
 * A microhydro plant on a hillside: a stream at the intake, the pipe down
 * through the head to a small powerhouse, and the hamlet's sixteen homes,
 * the first ones lit by as much power as ρ g Q h η gives.
 */
export function MicrohydroScene({
  flow,
  head,
}: {
  readonly flow: number;
  readonly head: number;
}) {
  const hill = useHillside(head);
  const drop = head * SCALE;
  const lit = homesLit(flow, head);
  const intake: [number, number, number] = [-RUN + 0.2, drop + 0.5, 1.5];
  const house: [number, number, number] = [0.9, 0.5, 1.5];

  return (
    <group>
      <mesh castShadow geometry={hill} receiveShadow>
        <meshStandardMaterial color={MATERIAL.foliageDark} roughness={1} />
      </mesh>
      <mesh
        position={[-RUN - 2, drop + 0.62, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[4, 2.4]} />
        <meshPhysicalMaterial
          clearcoat={1}
          color={MATERIAL.water}
          roughness={0.12}
        />
      </mesh>
      <Pipe from={intake} radius={0.16} to={house}>
        <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.5} />
      </Pipe>
      <Parcels
        color={MATERIAL.waterGlint}
        count={Math.max(2, Math.round(flow / 4))}
        from={[intake[0], intake[1], intake[2] + 0.18]}
        pace={0.15 + 0.3 * Math.sqrt(head / HEAD.max)}
        size={0.07}
        to={[house[0], house[1], house[2] + 0.18]}
      />
      <mesh castShadow position={[1.7, 0.6, 1.5]} receiveShadow>
        <boxGeometry args={[1.6, 1.2, 1.6]} />
        <meshStandardMaterial color={MATERIAL.concrete} roughness={0.8} />
      </mesh>
      {Arr.map(Arr.range(0, HOMES - 1), (home) => {
        const row = home < HOMES / 2 ? 0 : 1;
        const column = home % (HOMES / 2);
        return (
          <House
            at={[4 + column * 1.6, 0, -0.5 + row * 2.4]}
            key={home}
            lit={home < lit}
            size={1.1}
          />
        );
      })}
    </group>
  );
}
