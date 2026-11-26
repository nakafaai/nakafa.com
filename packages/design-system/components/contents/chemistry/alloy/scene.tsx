import { useThree } from "@react-three/fiber";
import type { AlloyMetal } from "@repo/design-system/components/contents/chemistry/alloy/model";
import { evaluateAlloySlip } from "@repo/design-system/components/contents/chemistry/alloy/model";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { PROCESS_COLORS } from "@repo/design-system/lib/material/process";
import { Array as Arr, Match } from "effect";
import { useMemo } from "react";

function AlloyCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.25, 2.7]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function hostMetalHex(metal: AlloyMetal): string {
  return Match.value(metal).pipe(
    Match.when("pureIron", () => PROCESS_COLORS.anodeZinc),
    Match.when("steel", () => PROCESS_COLORS.alloySteel),
    Match.when("bronze", () => PROCESS_COLORS.copperOrange),
    Match.when("brass", () => PROCESS_COLORS.alloyBronze),
    Match.exhaustive
  );
}

export function AlloySlipPlaneScene({
  metal,
  parts,
  shearForce,
}: {
  readonly metal: AlloyMetal;
  readonly parts: Readonly<
    Record<"foreignAtom" | "hostAtom" | "shearArrow" | "slipPlane", string>
  >;
  readonly shearForce: number;
}) {
  const slip = evaluateAlloySlip(metal, shearForce);
  const hostColor = hostMetalHex(metal);

  const atoms = useMemo(
    () =>
      Arr.makeBy(15, (index) => ({
        col: index % 5,
        id: `a-${index}`,
        row: Math.floor(index / 5),
      })),
    []
  );

  return (
    <group>
      <AlloyCamera />
      {/* 3 stacked atomic layers; top row slides by slip.layerShift */}
      {Arr.map(atoms, (atom) => {
        const isForeign =
          slip.hasForeignAtoms && atom.row === 1 && atom.col === 2;
        const shiftX = atom.row === 2 ? slip.layerShift : 0;
        const x = -0.68 + atom.col * 0.34 + shiftX;
        const y = 0.24 + atom.row * 0.3;
        return (
          <mesh castShadow key={atom.id} position={[x, y, 0]}>
            <sphereGeometry
              args={[isForeign ? slip.foreignRadius : 0.105, 16, 14]}
            />
            <meshStandardMaterial
              color={isForeign ? PROCESS_COLORS.electronGold : hostColor}
              metalness={0.55}
              roughness={0.28}
            />
          </mesh>
        );
      })}
      {/* Shear stress force arrow pushing top layer */}
      <mesh
        castShadow
        position={[-1.08, 0.84, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <coneGeometry args={[0.075, 0.24, 12]} />
        <meshStandardMaterial color={PROCESS_COLORS.hotRed} />
      </mesh>
      {/* Slip plane reference bar */}
      <mesh position={[0, 0.69, -0.14]}>
        <boxGeometry args={[1.8, 0.02, 0.04]} />
        <meshStandardMaterial color={PROCESS_COLORS.silicaBlue} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-1.02, 1.08, 0]}
      >
        <span>{parts.shearArrow}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.72, 0]}
      >
        <span>{parts.slipPlane}</span>
      </ThreeLabel>
      <ThreeLabel
        color={PROCESS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 0.24, 0.24]}
      >
        <span>{parts.hostAtom}</span>
      </ThreeLabel>
      {slip.hasForeignAtoms ? (
        <ThreeLabel
          color={PROCESS_COLORS.labelInk}
          fontSize="compact"
          position={[0.14, 0.56, 0.26]}
        >
          <span>{parts.foreignAtom}</span>
        </ThreeLabel>
      ) : null}
    </group>
  );
}
