import { useFrame } from "@react-three/fiber";
import {
  BIOLOGY_CONCEPT_SCENE_KIND,
  type BiologyConceptId,
  type BiologyLabItem,
  type BiologySceneColors,
} from "@repo/design-system/components/contents/biology/data";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import type React from "react";
import { useRef } from "react";
import type { Group } from "three";

const PARTICLES = Array.from({ length: 12 }, (_, index) => {
  const angle = (index / 12) * Math.PI * 2;
  return {
    id: index,
    x: Math.cos(angle),
    z: Math.sin(angle),
  };
});

const PROCESS_STAGES = [
  { id: "first", label: "1", radius: 0.45, x: -1.8 },
  { id: "second", label: "2", radius: 0.53, x: 0 },
  { id: "third", label: "3", radius: 0.61, x: 1.8 },
] as const;

const NETWORK_POINTS = [
  { id: "left", position: [-1.4, -0.45, 0] },
  { id: "center", position: [0, 0.65, 0] },
  { id: "right", position: [1.4, -0.45, 0] },
  { id: "base", position: [0, -1, 0] },
] as const;

/**
 * Routes each biology concept to the visual grammar declared in data.ts.
 */
export function BiologyConceptScene({
  colors,
  conceptId,
  item,
}: {
  colors: BiologySceneColors;
  conceptId: BiologyConceptId;
  item: BiologyLabItem;
}) {
  const sceneKind = BIOLOGY_CONCEPT_SCENE_KIND[conceptId];

  if (sceneKind === "climate") {
    return <ClimateScene colors={colors} item={item} />;
  }

  if (sceneKind === "network") {
    return <NetworkScene colors={colors} item={item} />;
  }

  if (sceneKind === "process") {
    return <ProcessScene colors={colors} item={item} />;
  }

  if (sceneKind === "cell") {
    return <CellScene colors={colors} item={item} />;
  }

  return <VirusScene colors={colors} item={item} />;
}

/**
 * Shows a compact virus-like particle with capsid, surface markers, and genome.
 */
function VirusScene({
  colors,
  item,
}: {
  colors: BiologySceneColors;
  item: BiologyLabItem;
}) {
  return (
    <group>
      <RotatingGroup>
        <mesh>
          <icosahedronGeometry args={[1.05, 2]} />
          <meshStandardMaterial
            color={colors.membrane}
            opacity={0.28}
            transparent
          />
        </mesh>
        {PARTICLES.map((particle) => (
          <mesh
            key={particle.id}
            position={[particle.x * 1.28, 0.1, particle.z * 1.28]}
          >
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color={colors.accent} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusKnotGeometry args={[0.48, 0.035, 96, 8]} />
          <meshStandardMaterial color={colors.path} />
        </mesh>
      </RotatingGroup>
      <SceneLabel color={colors.text} position={[0, 1.7, 0]}>
        {item.label}
      </SceneLabel>
    </group>
  );
}

/**
 * Shows staged biological processes as three connected 3D states.
 */
function ProcessScene({
  colors,
  item,
}: {
  colors: BiologySceneColors;
  item: BiologyLabItem;
}) {
  return (
    <group>
      {PROCESS_STAGES.map((stage) => (
        <group key={stage.id} position={[stage.x, 0, 0]}>
          <mesh>
            <sphereGeometry args={[stage.radius, 32, 32]} />
            <meshStandardMaterial
              color={stage.id === "second" ? colors.body : colors.membrane}
              opacity={0.52}
              transparent
            />
          </mesh>
          <SceneLabel
            color={colors.text}
            fontSize="compact"
            position={[0, 0.8, 0]}
          >
            {stage.label}
          </SceneLabel>
        </group>
      ))}
      <ArrowHelper color={colors.path} from={[-1.15, 0, 0]} to={[-0.5, 0, 0]} />
      <ArrowHelper color={colors.path} from={[0.55, 0, 0]} to={[1.15, 0, 0]} />
      <SceneLabel color={colors.text} position={[0, 1.55, 0]}>
        {item.label}
      </SceneLabel>
    </group>
  );
}

/**
 * Shows a simplified cell body with internal structures and particles.
 */
function CellScene({
  colors,
  item,
}: {
  colors: BiologySceneColors;
  item: BiologyLabItem;
}) {
  return (
    <group>
      <RotatingGroup>
        <mesh scale={[1.65, 0.72, 0.72]}>
          <sphereGeometry args={[1, 48, 32]} />
          <meshStandardMaterial
            color={colors.body}
            opacity={0.38}
            transparent
          />
        </mesh>
        <mesh position={[0.2, 0.08, 0.18]} scale={[0.52, 0.25, 0.25]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshStandardMaterial color={colors.membrane} />
        </mesh>
        {PARTICLES.slice(0, 7).map((particle) => (
          <mesh
            key={particle.id}
            position={[
              particle.x * 1.05,
              particle.id * 0.05 - 0.15,
              particle.z * 0.38,
            ]}
          >
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color={colors.accent} />
          </mesh>
        ))}
      </RotatingGroup>
      <SceneLabel color={colors.text} position={[0, 1.3, 0]}>
        {item.label}
      </SceneLabel>
    </group>
  );
}

/**
 * Shows relationship-based concepts as connected nodes and directional links.
 */
function NetworkScene({
  colors,
  item,
}: {
  colors: BiologySceneColors;
  item: BiologyLabItem;
}) {
  return (
    <group>
      <ArrowHelper
        color={colors.path}
        from={NETWORK_POINTS[0].position}
        to={NETWORK_POINTS[1].position}
      />
      <ArrowHelper
        color={colors.path}
        from={NETWORK_POINTS[1].position}
        to={NETWORK_POINTS[2].position}
      />
      <ArrowHelper
        color={colors.path}
        from={NETWORK_POINTS[3].position}
        to={NETWORK_POINTS[1].position}
      />
      {NETWORK_POINTS.map((point) => (
        <mesh key={point.id} position={point.position}>
          <sphereGeometry args={[0.28, 24, 24]} />
          <meshStandardMaterial
            color={point.id === "center" ? colors.body : colors.accent}
          />
        </mesh>
      ))}
      <SceneLabel color={colors.text} position={[0, 1.35, 0]}>
        {item.label}
      </SceneLabel>
    </group>
  );
}

/**
 * Shows climate concepts as an Earth system with atmosphere and energy markers.
 */
function ClimateScene({
  colors,
  item,
}: {
  colors: BiologySceneColors;
  item: BiologyLabItem;
}) {
  return (
    <group>
      <RotatingGroup>
        <mesh>
          <sphereGeometry args={[0.95, 48, 32]} />
          <meshStandardMaterial color={colors.body} roughness={0.62} />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.18, 48, 32]} />
          <meshStandardMaterial
            color={colors.accent}
            opacity={0.18}
            transparent
          />
        </mesh>
        {PARTICLES.slice(0, 8).map((particle) => (
          <mesh
            key={particle.id}
            position={[particle.x * 1.45, 0.4, particle.z * 1.45]}
          >
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshStandardMaterial color={colors.path} />
          </mesh>
        ))}
      </RotatingGroup>
      <SceneLabel color={colors.text} position={[0, 1.65, 0]}>
        {item.label}
      </SceneLabel>
    </group>
  );
}

/**
 * Rotates a concept model slowly so first render remains readable.
 */
function RotatingGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.y += delta * 0.18;
  });

  return <group ref={ref}>{children}</group>;
}
