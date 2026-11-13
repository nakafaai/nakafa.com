import { useFrame } from "@react-three/fiber";
import {
  type Sea,
  surfaceHeight,
} from "@repo/design-system/components/contents/physics/renewable-energy/wave/swell";
import {
  Pipe,
  useSceneTime,
} from "@repo/design-system/components/contents/physics/renewable-energy/world/parts";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { useMemo, useRef } from "react";
import { type Group, PlaneGeometry } from "three";

/** Scene units per metre: the sea is drawn at one unit to two metres. */
const SCALE = 0.5;

/** How much sea the scene spans, in metres along the waves and across them. */
const SPAN = { across: 260, along: 360 } as const;

/** How many times taller than true the waves are drawn, so a 1 m swell can be seen. */
const STRETCH = 4;

/** Where the buoy floats, in metres along the waves from the scene's middle. */
const BUOY_AT = 10;

/** The buoy's radius, in metres. */
const BUOY = 4;

/**
 * Open sea rolling past a wave-energy buoy, its height stretched four times. The surface moves
 * with the regular wave of the chosen sea, ρ g² H² T / (64π) watts across
 * every metre of crest, and the buoy heaves with the water at its place.
 */
export function WaveScene({ sea }: { readonly sea: Sea }) {
  const time = useSceneTime();
  const buoy = useRef<Group>(null);
  const surface = useMemo(() => {
    const plane = new PlaneGeometry(
      SPAN.along * SCALE,
      SPAN.across * SCALE,
      240,
      24
    );
    plane.rotateX(-Math.PI / 2);
    return plane;
  }, []);

  useFrame(() => {
    const position = surface.getAttribute("position");
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const metres = position.getX(vertex) / SCALE;
      position.setY(
        vertex,
        surfaceHeight(sea, metres, time.current) * SCALE * STRETCH
      );
    }
    position.needsUpdate = true;
    surface.computeVertexNormals();
    const rise = surfaceHeight(sea, BUOY_AT, time.current) * SCALE * STRETCH;
    const ahead =
      surfaceHeight(sea, BUOY_AT + 2, time.current) * SCALE * STRETCH;
    buoy.current?.position.set(BUOY_AT * SCALE, rise, 0);
    buoy.current?.rotation.set(0, 0, Math.atan2(ahead - rise, 2 * SCALE));
  });

  return (
    <group>
      <mesh geometry={surface} receiveShadow>
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.08}
          color={MATERIAL.water}
          metalness={0.05}
          roughness={0.18}
        />
      </mesh>
      <group ref={buoy}>
        <mesh castShadow position={[0, 0.25, 0]}>
          <cylinderGeometry
            args={[BUOY * SCALE, BUOY * SCALE * 0.9, 1.4, 40]}
          />
          <meshStandardMaterial color={MATERIAL.buoyPaint} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.98, 0]}>
          <cylinderGeometry
            args={[BUOY * SCALE * 0.35, BUOY * SCALE * 0.4, 0.4, 24]}
          />
          <meshStandardMaterial
            color={getColor("SLATE", 300)}
            roughness={0.5}
          />
        </mesh>
        <Pipe from={[0, 1.1, 0]} radius={0.06} to={[0, 3.2, 0]}>
          <MetalMaterial color={MATERIAL.galvanizedSteel} roughness={0.4} />
        </Pipe>
        <mesh position={[0, 3.3, 0]}>
          <sphereGeometry args={[0.16, 16, 12]} />
          <meshStandardMaterial
            color={MATERIAL.windowGlow}
            emissive={MATERIAL.windowGlow}
            emissiveIntensity={1.5}
          />
        </mesh>
      </group>
    </group>
  );
}
