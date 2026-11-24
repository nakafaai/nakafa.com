import { useFrame, useThree } from "@react-three/fiber";
import type { MembraneComponent } from "@repo/design-system/components/contents/biology/mosaic/model";
import { evaluateMembraneFluidity } from "@repo/design-system/components/contents/biology/mosaic/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function MosaicCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.6, 3.4] : [0, 1.35, 2.75]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function FluidMosaicScene({
  component,
  parts,
  temperatureC,
}: {
  readonly component: MembraneComponent;
  readonly parts: Readonly<
    Record<
      | "cholesterol"
      | "glycolipid"
      | "glycoprotein"
      | "hydrophilicHead"
      | "hydrophobicTail"
      | "integralProtein",
      string
    >
  >;
  readonly temperatureC: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const bilayerRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const fluidity = evaluateMembraneFluidity(temperatureC);

  const phospholipids = useMemo(
    () =>
      Arr.makeBy(10, (index) => ({
        id: `pl-${index}`,
        x: -1.08 + index * 0.24,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || bilayerRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * fluidity.lateralWaveSpeed;
    bilayerRef.current.position.x =
      Math.sin(phaseRef.current) * fluidity.lateralWaveAmplitude;
  });

  const highlight = (target: MembraneComponent) =>
    component === target ? 1 : 0.52;

  return (
    <group>
      <SimulationTicker running={playing} />
      <MosaicCamera />
      <group ref={bilayerRef}>
        {/* Phospholipid bilayer */}
        {Arr.map(phospholipids, (unit) => (
          <group key={unit.id} position={[unit.x, 0.54, 0]}>
            <mesh position={[0, 0.17, 0]}>
              <sphereGeometry args={[0.068, 12, 10]} />
              <meshStandardMaterial
                color={HOMEOSTASIS_COLORS.bilayerHead}
                opacity={highlight("phospholipid")}
                roughness={0.4}
                transparent
              />
            </mesh>
            <mesh position={[0, -0.17, 0]}>
              <sphereGeometry args={[0.068, 12, 10]} />
              <meshStandardMaterial
                color={HOMEOSTASIS_COLORS.bilayerHead}
                opacity={highlight("phospholipid")}
                roughness={0.4}
                transparent
              />
            </mesh>
            <mesh position={[-0.02, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.26, 8]} />
              <meshStandardMaterial
                color={HOMEOSTASIS_COLORS.bilayerTail}
                opacity={highlight("phospholipid")}
                transparent
              />
            </mesh>
            <mesh position={[0.02, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.26, 8]} />
              <meshStandardMaterial
                color={HOMEOSTASIS_COLORS.bilayerTail}
                opacity={highlight("phospholipid")}
                transparent
              />
            </mesh>
          </group>
        ))}

        {/* Cholesterol rings nestled between hydrophobic tails */}
        <mesh castShadow position={[-0.48, 0.54, 0.08]}>
          <boxGeometry args={[0.09, 0.22, 0.09]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.cholesterol}
            opacity={highlight("cholesterol")}
            roughness={0.35}
            transparent
          />
        </mesh>
        <mesh castShadow position={[0.48, 0.54, 0.08]}>
          <boxGeometry args={[0.09, 0.22, 0.09]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.cholesterol}
            opacity={highlight("cholesterol")}
            roughness={0.35}
            transparent
          />
        </mesh>

        {/* Transmembrane integral protein */}
        <mesh castShadow position={[0, 0.54, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.56, 20]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.channelProtein}
            opacity={highlight("integralProtein")}
            roughness={0.38}
            transparent
          />
        </mesh>

        {/* Glycoprotein carbohydrate antenna on integral protein */}
        <group position={[0.06, 0.9, 0]}>
          <mesh position={[0, 0, 0]}>
            <octahedronGeometry args={[0.055, 0]} />
            <meshStandardMaterial
              color={HOMEOSTASIS_COLORS.glycoprotein}
              opacity={highlight("glycoprotein")}
              transparent
            />
          </mesh>
          <mesh position={[0.09, 0.08, 0]}>
            <octahedronGeometry args={[0.05, 0]} />
            <meshStandardMaterial
              color={HOMEOSTASIS_COLORS.glycoprotein}
              opacity={highlight("glycoprotein")}
              transparent
            />
          </mesh>
        </group>

        {/* Glycolipid chain on outer phospholipid head */}
        <mesh position={[-0.84, 0.84, 0]}>
          <octahedronGeometry args={[0.052, 0]} />
          <meshStandardMaterial
            color={HOMEOSTASIS_COLORS.glycolipid}
            roughness={0.35}
          />
        </mesh>
      </group>

      {/* Labels */}
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-1.0, 1.02, 0]}
      >
        <span>{parts.glycolipid}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.28, 1.12, 0]}
      >
        <span>{parts.glycoprotein}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.92, 0]}
      >
        <span>{parts.hydrophilicHead}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.54, 0.2]}
      >
        <span>{parts.hydrophobicTail}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.2, 0.22]}
      >
        <span>{parts.cholesterol}</span>
      </ThreeLabel>
      <ThreeLabel
        color={HOMEOSTASIS_COLORS.labelInk}
        fontSize="compact"
        position={[0.08, 0.14, 0.24]}
      >
        <span>{parts.integralProtein}</span>
      </ThreeLabel>
    </group>
  );
}
