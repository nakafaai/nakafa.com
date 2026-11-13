import { useFrame } from "@react-three/fiber";
import {
  type Fuel,
  HEAT_INPUT,
  wasteHeat,
} from "@repo/design-system/components/contents/physics/renewable-energy/steam/cycle";
import {
  Parcels,
  Pipe,
  Puffs,
  useSceneTime,
} from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import { DoubleSide, type Group, LatheGeometry, Vector2 } from "three";

/** The glow of each heat source: a coal fire, a gas flame, a reactor's blue light. */
const SOURCE_GLOW = {
  coal: MATERIAL.coalGlow,
  gas: MATERIAL.gasFlame,
  uranium: MATERIAL.reactorGlow,
} as const satisfies Record<Fuel, string>;

/** The cooling tower's waisted shell, turned on a lathe. */
function useTower() {
  return useMemo(() => {
    const outline = Arr.map(Arr.range(0, 16), (step) => {
      const share = step / 16;
      return new Vector2(
        1.7 - 0.9 * Math.sin(Math.PI * share * 0.85),
        share * 5.2
      );
    });
    return new LatheGeometry(outline, 48);
  }, []);
}

/** The heat source: a coal store and furnace, a gas main and burner, or a reactor dome. */
function Source({ fuel }: { readonly fuel: Fuel }) {
  const glow = SOURCE_GLOW[fuel];
  return (
    <group position={[-6, 0, 0]}>
      {fuel === "uranium" ? (
        <mesh castShadow position={[0, 1.6, 0]}>
          <sphereGeometry
            args={[1.9, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial color={MATERIAL.concrete} roughness={0.8} />
        </mesh>
      ) : (
        <mesh castShadow position={[0, 1.6, 0]} receiveShadow>
          <boxGeometry args={[3, 3.2, 2.6]} />
          <meshStandardMaterial color={MATERIAL.concrete} roughness={0.85} />
        </mesh>
      )}
      <mesh
        position={[
          fuel === "uranium" ? 0 : 1.51,
          1,
          fuel === "uranium" ? 1.9 : 0,
        ]}
      >
        <planeGeometry args={[1.1, 0.8]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={2.5}
        />
      </mesh>
      {fuel === "coal" ? (
        <mesh castShadow position={[-0.2, 0.8, 2.6]}>
          <coneGeometry args={[1.4, 1.6, 24]} />
          <meshStandardMaterial color={MATERIAL.coalLump} roughness={0.9} />
        </mesh>
      ) : null}
      {fuel === "gas" ? (
        <Pipe from={[-3, 0.5, 1]} radius={0.22} to={[-1.4, 0.5, 1]}>
          <MetalMaterial color={MATERIAL.buoyPaint} roughness={0.5} />
        </Pipe>
      ) : null}
    </group>
  );
}

/**
 * A steam power plant taking in 1000 MW of heat. The fuel only changes the
 * heat source; steam then runs to the same turbine and generator, and the
 * cooling tower breathes out the heat the turbine could not use.
 */
export function SteamScene({
  colors,
  fuel,
}: {
  readonly colors: Readonly<{ electric: string; waste: string }>;
  readonly fuel: Fuel;
}) {
  const tower = useTower();
  const time = useSceneTime();
  const rotor = useRef<Group>(null);
  const waste = wasteHeat(fuel) / HEAT_INPUT;

  useFrame(() => {
    rotor.current?.rotation.set(time.current * 8, 0, 0);
  });

  return (
    <group>
      <Source fuel={fuel} />
      <Pipe from={[-4.5, 3, 0]} radius={0.16} to={[-1.2, 1.5, 0]}>
        <MetalMaterial color={MATERIAL.chrome} roughness={0.3} />
      </Pipe>
      <Parcels
        color={MATERIAL.cloud}
        count={6}
        from={[-4.5, 3, 0.18]}
        pace={0.5}
        size={0.1}
        to={[-1.2, 1.5, 0.18]}
      />
      <group position={[0, 1.4, 0]}>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.9, 0.5, 2.4, 32]} />
          <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.4} />
        </mesh>
        <group ref={rotor}>
          {Arr.map(Arr.range(0, 5), (blade) => (
            <mesh
              key={blade}
              position={[-1.25, 0, 0]}
              rotation={[(blade * Math.PI) / 3, 0, 0]}
            >
              <boxGeometry args={[0.06, 1.1, 0.12]} />
              <MetalMaterial color={MATERIAL.brass} roughness={0.3} />
            </mesh>
          ))}
        </group>
        <mesh castShadow position={[2.1, 0, 0]}>
          <boxGeometry args={[1.6, 1.4, 1.4]} />
          <meshStandardMaterial color={MATERIAL.castIron} roughness={0.55} />
        </mesh>
      </group>
      <Parcels
        color={colors.electric}
        count={5}
        from={[2.9, 1.4, 0]}
        pace={0.4}
        size={0.08}
        to={[4.6, 4, -2]}
      />
      <Pipe from={[1, 0.3, 0.8]} radius={0.12} to={[6.4, 0.3, 0.8]}>
        <meshStandardMaterial color={colors.waste} roughness={0.6} />
      </Pipe>
      <mesh castShadow geometry={tower} position={[8, 0, 0]} receiveShadow>
        <meshStandardMaterial
          color={MATERIAL.concrete}
          roughness={0.9}
          side={DoubleSide}
        />
      </mesh>
      <Puffs amount={waste} at={[8, 5.4, 0]} rise={5} size={1.4} />
    </group>
  );
}
