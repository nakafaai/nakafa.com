import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Condition,
  Level,
} from "@repo/design-system/components/contents/biology/protein/folding";
import { polypeptideBeads } from "@repo/design-system/components/contents/biology/protein/folding";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.88, 2.2];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

const SUBUNIT_COLORS = [
  PLOT_COLORS.teal,
  PLOT_COLORS.violet,
  PLOT_COLORS.amber,
  PLOT_COLORS.pink,
] as const;

const QUATERNARY_HAEMS: readonly (readonly [number, number, number])[] = [
  [-0.32, 0.78, 0.12],
  [0.32, 0.78, -0.12],
  [-0.32, 0.36, -0.12],
  [0.32, 0.36, 0.12],
];

/**
 * 3D polypeptide scene morphing across primary, secondary (alpha-helix and
 * beta-sheet), tertiary globule, and quaternary 4-subunit haemoglobin, plus
 * thermal/acid denaturation uncoiling with covalent peptide backbone intact.
 */
export function ProteinScene({
  condition,
  level,
  parts,
}: {
  readonly condition: Condition;
  readonly level: Level;
  readonly parts: Readonly<
    Record<"chain" | "helix" | "sheet" | "haem", string>
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);

  const beads = useMemo(
    () => polypeptideBeads(level, condition),
    [condition, level]
  );

  const peptideGeo = useMemo(() => {
    const pts = Arr.flatMap(beads, (a, i) => {
      const b = beads[i + 1];
      return b === undefined || a.subunit !== b.subunit
        ? []
        : [
            new Vector3(a.position[0], a.position[1], a.position[2]),
            new Vector3(b.position[0], b.position[1], b.position[2]),
          ];
    });
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [beads]);

  useEffect(() => () => peptideGeo.dispose(), [peptideGeo]);

  useFrame((_, delta) => {
    if (!playing || rootRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    if (condition === "normal") {
      rootRef.current.rotation.y = Math.sin(clock.current * 0.7) * 0.35;
      rootRef.current.position.y = 0;
    } else {
      rootRef.current.rotation.y = Math.sin(clock.current * 5) * 0.04;
      rootRef.current.position.y = Math.sin(clock.current * 11) * 0.018;
    }
  });

  const showHaem =
    condition === "normal" && (level === "tertiary" || level === "quaternary");

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.1, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      <group ref={rootRef}>
        {Arr.map(beads, (bead) => (
          <mesh castShadow key={bead.id} position={bead.position}>
            <sphereGeometry args={[0.056, 16, 16]} />
            <meshStandardMaterial
              color={SUBUNIT_COLORS[bead.subunit % SUBUNIT_COLORS.length]}
              roughness={0.4}
            />
          </mesh>
        ))}

        {/* Covalent peptide backbone always stays connected */}
        <lineSegments geometry={peptideGeo}>
          <lineBasicMaterial color={LABORATORY_COLORS.steel} />
        </lineSegments>

        {/* Haem prosthetic groups (red porphyrin disc + iron ion) */}
        {showHaem && level === "tertiary" && (
          <mesh position={[0, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.028, 16]} />
            <meshStandardMaterial color={BIOLOGY_COLORS.blood} />
          </mesh>
        )}
        {showHaem &&
          level === "quaternary" &&
          Arr.map(QUATERNARY_HAEMS, ([x, y, z]) => (
            <mesh
              key={`${x}-${y}-${z}`}
              position={[x, y, z]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.072, 0.072, 0.024, 16]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.blood} />
            </mesh>
          ))}

        {/* Denaturing environment markers: acid H+ ions or heat glow */}
        {condition === "acid" &&
          Arr.map([-0.6, -0.2, 0.25, 0.65] as const, (x) => (
            <mesh key={x} position={[x, 0.92, 0.15]}>
              <sphereGeometry args={[0.032, 12, 12]} />
              <meshStandardMaterial color={ATOM_COLORS.cpkHydrogen} />
            </mesh>
          ))}
        {condition === "heated" && (
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.62, 0.68, 0.04, 24]} />
            <meshStandardMaterial
              color={LABORATORY_COLORS.flame}
              emissive={LABORATORY_COLORS.flame}
              emissiveIntensity={0.65}
            />
          </mesh>
        )}
      </group>

      {condition === "normal" && level === "primary" && (
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[0, 0.72, 0]}
        >
          {parts.chain}
        </ThreeLabel>
      )}
      {condition === "normal" && level === "secondary" && (
        <group>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.04}
            position={[-0.45, 0.84, 0]}
          >
            {parts.helix}
          </ThreeLabel>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.04}
            position={[0.48, 0.84, 0]}
          >
            {parts.sheet}
          </ThreeLabel>
        </group>
      )}
      {showHaem && (
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          gap={0.04}
          position={[0, 0.94, 0]}
        >
          {parts.haem}
        </ThreeLabel>
      )}
    </group>
  );
}
