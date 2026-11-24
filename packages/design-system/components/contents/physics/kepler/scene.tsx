import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitingBody } from "@repo/design-system/components/contents/physics/kepler/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Mesh } from "three";

function bodyColor(body: OrbitingBody): string {
  return Match.value(body).pipe(
    Match.when("mercury", () => QUANTUM_COLORS.mercury),
    Match.when("venus", () => QUANTUM_COLORS.venus),
    Match.when("earth", () => QUANTUM_COLORS.earth),
    Match.when("mars", () => QUANTUM_COLORS.mars),
    Match.when("jupiter", () => QUANTUM_COLORS.jupiter),
    Match.when("comet", () => QUANTUM_COLORS.comet),
    Match.exhaustive
  );
}

function KeplerCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 2.8, 3.2] : [0, 2.35, 2.55]}
      cameraTarget={[0, 0.25, 0]}
      fov={38}
      maxDistance={6.5}
      minDistance={1.5}
    />
  );
}

export function KeplerOrbitScene({
  body,
  eccentricity,
  parts,
}: {
  readonly body: OrbitingBody;
  readonly eccentricity: number;
  readonly parts: Readonly<
    Record<
      "aphelion" | "areaSector" | "focus" | "perihelion" | "planet" | "sun",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const planetRef = useRef<Mesh>(null);
  const anomalyRef = useRef(0.6);

  const a = 1.25;
  const e = Math.min(0.85, Math.max(0, eccentricity));
  const b = a * Math.sqrt(1 - e * e);
  const c = a * e;

  const trackDots = useMemo(
    () =>
      Arr.makeBy(36, (index) => {
        const theta = (index / 36) * Math.PI * 2;
        return {
          id: `t-${index}`,
          x: a * Math.cos(theta),
          z: b * Math.sin(theta),
        };
      }),
    [b]
  );

  useFrame((_, delta) => {
    const planet = planetRef.current;
    if (planet === null) {
      return;
    }
    const rNorm = Math.max(0.25, 1 - e * Math.cos(anomalyRef.current));
    if (playing) {
      // Kepler's 2nd law: angular speed increases near perihelion
      anomalyRef.current += (simulationStep(delta) * 1.1) / (rNorm * rNorm);
    }
    planet.position.set(
      a * Math.cos(anomalyRef.current),
      0.26,
      b * Math.sin(anomalyRef.current)
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <KeplerCamera />
      {/* Orbit track markers */}
      {Arr.map(trackDots, (dot) => (
        <mesh key={dot.id} position={[dot.x, 0.24, dot.z]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial
            color={QUANTUM_COLORS.orbitTrack}
            roughness={0.5}
          />
        </mesh>
      ))}
      {/* Equal-area sector wedges at perihelion and aphelion */}
      <mesh
        position={[c + (a - c) * 0.45, 0.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[Math.max(0.18, (a - c) * 0.65), 16, -0.5, 1]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.sectorFill}
          opacity={0.35}
          roughness={0.4}
          transparent
        />
      </mesh>
      {/* Sun at right focus + empty left focus */}
      <mesh castShadow position={[c, 0.26, 0]}>
        <sphereGeometry args={[0.18, 20, 16]} />
        <meshStandardMaterial
          color={QUANTUM_COLORS.sunCore}
          emissive={QUANTUM_COLORS.sunCore}
          emissiveIntensity={0.4}
          roughness={0.3}
        />
      </mesh>
      <mesh position={[-c, 0.24, 0]}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial color={QUANTUM_COLORS.aphelion} roughness={0.4} />
      </mesh>
      {/* Orbiting planet */}
      <mesh
        castShadow
        position={[a * Math.cos(0.6), 0.26, b * Math.sin(0.6)]}
        ref={planetRef}
      >
        <sphereGeometry args={[0.1, 16, 14]} />
        <meshStandardMaterial color={bodyColor(body)} roughness={0.4} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[c, 0.56, 0]}
      >
        <span>{parts.sun}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-c, 0.44, 0]}
      >
        <span>{parts.focus}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[a + 0.16, 0.42, 0]}
      >
        <span>{parts.perihelion}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[-a - 0.16, 0.42, 0]}
      >
        <span>{parts.aphelion}</span>
      </ThreeLabel>
      <ThreeLabel
        color={QUANTUM_COLORS.labelInk}
        fontSize="compact"
        position={[0.6, 0.44, b + 0.16]}
      >
        <span>
          {parts.planet} / {parts.areaSector}
        </span>
      </ThreeLabel>
    </group>
  );
}
