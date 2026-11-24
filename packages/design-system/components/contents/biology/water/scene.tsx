import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Property,
  WaterMolecule,
} from "@repo/design-system/components/contents/biology/water/bonds";
import {
  ETHANOL_SPECIFIC_HEAT,
  temperatureRise,
  visualColumnHeight,
  WATER_SPECIFIC_HEAT,
  waterLattice,
} from "@repo/design-system/components/contents/biology/water/bonds";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.78, 2.05];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.58, 0];

/**
 * 3D molecular scene for polar H2O hydrogen bonding: cohesion in a xylem
 * column, adhesion climbing a hydrophilic wall with concave meniscus, and
 * specific heat comparison of water versus ethanol under equal heating.
 */
export function WaterScene({
  bondLabel,
  heatJ,
  hydrogenLabel,
  massG,
  oxygenLabel,
  property,
  radiusMax,
  radiusMin,
  radiusUm,
  wallLabel,
}: {
  readonly bondLabel: string;
  readonly heatJ: number;
  readonly hydrogenLabel: string;
  readonly massG: number;
  readonly oxygenLabel: string;
  readonly property: Property;
  readonly radiusMax: number;
  readonly radiusMin: number;
  readonly radiusUm: number;
  readonly wallLabel: string;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const groupRef = useRef<Group>(null);
  const clock = useRef(0);

  const columnHeight = visualColumnHeight(radiusUm, radiusMin, radiusMax);
  const tubeRadius =
    0.16 +
    0.18 *
      Math.max(
        0,
        Math.min(1, (radiusUm - radiusMin) / Math.max(1, radiusMax - radiusMin))
      );
  const molecules = useMemo(
    () => waterLattice(property, columnHeight),
    [columnHeight, property]
  );

  const waterDelta = temperatureRise(heatJ, massG, WATER_SPECIFIC_HEAT);
  const ethanolDelta = temperatureRise(heatJ, massG, ETHANOL_SPECIFIC_HEAT);

  useFrame((_, delta) => {
    if (!playing || groupRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    const amp = property === "heat" ? 0.015 : 0.008;
    groupRef.current.position.y = Math.sin(clock.current * 4.5) * amp;
  });

  const bondGeo = useMemo(() => {
    const pts = Arr.flatMap(molecules, (a, i) => {
      const b = molecules[i + 1];
      return b === undefined
        ? []
        : [
            new Vector3(a.h1[0], a.h1[1], a.h1[2]),
            new Vector3(b.oxygen[0], b.oxygen[1], b.oxygen[2]),
          ];
    });
    const geometry = new BufferGeometry();
    geometry.setFromPoints(pts);
    return geometry;
  }, [molecules]);

  useEffect(() => () => bondGeo.dispose(), [bondGeo]);

  const first = molecules[0];

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      {/* Base plate */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[1.85, 0.04, 0.9]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      {property === "heat" ? (
        <group>
          {/* Left beaker: water (slower rise due to dense H-bond network) */}
          <group position={[-0.4, 0, 0]}>
            <mesh position={[0, 0.34, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.68, 28]} />
              <meshPhysicalMaterial
                color={LABORATORY_COLORS.polystyrene}
                opacity={0.28}
                roughness={0.1}
                transparent
              />
            </mesh>
            <mesh position={[0, 0.24, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.46, 26]} />
              <meshStandardMaterial
                color={LABORATORY_COLORS.water}
                opacity={0.45}
                transparent
              />
            </mesh>
            {/* Thermometer column proportional to water temperature rise */}
            <mesh position={[0.22, 0.42, 0.16]}>
              <cylinderGeometry args={[0.024, 0.024, 0.72, 16]} />
              <meshStandardMaterial color={LABORATORY_COLORS.paper} />
            </mesh>
            <mesh
              position={[
                0.22,
                0.14 + Math.min(0.54, waterDelta * 0.022) / 2,
                0.165,
              ]}
            >
              <cylinderGeometry
                args={[0.015, 0.015, Math.min(0.54, waterDelta * 0.022), 14]}
              />
              <meshStandardMaterial color={PLOT_COLORS.teal} />
            </mesh>
          </group>

          {/* Right beaker: ethanol (faster temperature rise) */}
          <group position={[0.42, 0, 0]}>
            <mesh position={[0, 0.34, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.68, 28]} />
              <meshPhysicalMaterial
                color={LABORATORY_COLORS.polystyrene}
                opacity={0.28}
                roughness={0.1}
                transparent
              />
            </mesh>
            <mesh position={[0, 0.24, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.46, 26]} />
              <meshStandardMaterial
                color={PLOT_COLORS.amber}
                opacity={0.42}
                transparent
              />
            </mesh>
            <mesh position={[0.22, 0.42, 0.16]}>
              <cylinderGeometry args={[0.024, 0.024, 0.72, 16]} />
              <meshStandardMaterial color={LABORATORY_COLORS.paper} />
            </mesh>
            <mesh
              position={[
                0.22,
                0.14 + Math.min(0.58, ethanolDelta * 0.022) / 2,
                0.165,
              ]}
            >
              <cylinderGeometry
                args={[0.015, 0.015, Math.min(0.58, ethanolDelta * 0.022), 14]}
              />
              <meshStandardMaterial color={PLOT_COLORS.orange} />
            </mesh>
          </group>
        </group>
      ) : (
        <group>
          {/* Hydrophilic xylem / glass capillary tube */}
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[tubeRadius, tubeRadius, 1.18, 32]} />
            <meshPhysicalMaterial
              color={LABORATORY_COLORS.polystyrene}
              opacity={0.25}
              roughness={0.12}
              transparent
            />
          </mesh>
          {/* Rising water column */}
          <mesh position={[0, (columnHeight * 1.05) / 2, 0]}>
            <cylinderGeometry
              args={[
                tubeRadius * 0.92,
                tubeRadius * 0.92,
                columnHeight * 1.05,
                28,
              ]}
            />
            <meshStandardMaterial
              color={LABORATORY_COLORS.water}
              opacity={0.38}
              transparent
            />
          </mesh>
          {/* Concave meniscus ring at top of column */}
          <mesh
            position={[0, columnHeight * 1.05 + 0.01, 0]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[tubeRadius * 0.88, 0.014, 12, 28]} />
            <meshStandardMaterial color={PLOT_COLORS.teal} />
          </mesh>
          <ThreeLabel
            anchorX="left"
            color={ink}
            gap={0.04}
            position={[tubeRadius + 0.08, 0.86, 0]}
          >
            {wallLabel}
          </ThreeLabel>
        </group>
      )}

      {/* Polar H2O molecules and dashed hydrogen bonds */}
      <group ref={groupRef}>
        {Arr.map(molecules, (molecule) => (
          <MoleculeMesh
            key={`${molecule.oxygen[0]}-${molecule.oxygen[1]}-${molecule.h1[0]}`}
            molecule={molecule}
          />
        ))}
        <lineSegments geometry={bondGeo}>
          <lineBasicMaterial color={PLOT_COLORS.teal} />
        </lineSegments>
      </group>

      {first !== undefined && (
        <group>
          <ThreeLabel
            anchorX="right"
            color={ink}
            gap={0.04}
            position={[first.oxygen[0] - 0.1, first.oxygen[1], 0]}
          >
            {oxygenLabel}
          </ThreeLabel>
          <ThreeLabel
            anchorX="left"
            color={ink}
            gap={0.04}
            position={[first.h1[0] + 0.1, first.h1[1] + 0.02, 0]}
          >
            {hydrogenLabel}
          </ThreeLabel>
          <ThreeLabel
            anchorX="left"
            color={ink}
            gap={0.04}
            position={[first.oxygen[0] + 0.16, first.oxygen[1] + 0.16, 0]}
          >
            {bondLabel}
          </ThreeLabel>
        </group>
      )}
    </group>
  );
}

/** Single CPK-coloured polar water molecule (red oxygen, two white hydrogens). */
function MoleculeMesh({ molecule }: { readonly molecule: WaterMolecule }) {
  return (
    <group>
      <mesh castShadow position={molecule.oxygen}>
        <sphereGeometry args={[0.052, 18, 18]} />
        <meshStandardMaterial color={ATOM_COLORS.cpkOxygen} roughness={0.35} />
      </mesh>
      <mesh castShadow position={molecule.h1}>
        <sphereGeometry args={[0.032, 14, 14]} />
        <meshStandardMaterial
          color={ATOM_COLORS.cpkHydrogen}
          roughness={0.35}
        />
      </mesh>
      <mesh castShadow position={molecule.h2}>
        <sphereGeometry args={[0.032, 14, 14]} />
        <meshStandardMaterial
          color={ATOM_COLORS.cpkHydrogen}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}
