import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Insect } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import {
  growthAt,
  lengthCurvePoints,
} from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.86, 2.25];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.54, 0];

export type MetamorphosisPart =
  | "exoskeleton"
  | "exuvia"
  | "wingBud"
  | "wing"
  | "headCapsule"
  | "leaf";

/**
 * 3D insect metamorphosis scene: food leaf supporting the developing insect
 * (egg -> nymph/larva -> pupa -> winged adult) with shed exuvia during ecdysis
 * moults and a stepped exoskeleton-length growth chart in the backdrop.
 */
export function MetamorphosisScene({
  insect,
  onTime,
  parts,
  time,
}: {
  readonly insect: Insect;
  readonly onTime: (next: number) => void;
  readonly parts: Readonly<Record<MetamorphosisPart, string>>;
  readonly time: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(time);
  const lastSent = useRef(time);

  if (!playing) {
    clock.current = time;
    lastSent.current = time;
  }

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = (clock.current + simulationStep(delta) * 0.1) % 1;
    if (Math.abs(clock.current - lastSent.current) >= 0.015) {
      lastSent.current = clock.current;
      onTime(Math.round(clock.current * 100) / 100);
    }
  });

  const snap = growthAt(insect, time);
  const bodyScale = 0.4 + (snap.lengthMm / 42) * 0.85;
  const cursorX = -0.85 + time * 1.7;

  const curveGeo = useMemo(() => {
    const pts = lengthCurvePoints(insect);
    const segs = Arr.flatMap(pts, (a, i) => {
      const b = pts[i + 1];
      return b === undefined
        ? []
        : [new Vector3(a[0], a[1], a[2]), new Vector3(b[0], b[1], b[2])];
    });
    const geo = new BufferGeometry();
    geo.setFromPoints(segs);
    return geo;
  }, [insect]);

  useEffect(() => () => curveGeo.dispose(), [curveGeo]);

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.0]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      {/* Stepped exoskeleton growth curve backdrop */}
      <mesh position={[0, 0.82, -0.26]}>
        <boxGeometry args={[1.9, 0.62, 0.03]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.paper}
          roughness={0.85}
        />
      </mesh>
      <lineSegments geometry={curveGeo}>
        <lineBasicMaterial color={PLOT_COLORS.teal} />
      </lineSegments>
      <mesh position={[cursorX, 0.82, -0.2]}>
        <boxGeometry args={[0.014, 0.56, 0.014]} />
        <meshStandardMaterial color={PLOT_COLORS.amber} />
      </mesh>

      {/* Food plant leaf */}
      <mesh position={[0, 0.08, 0.16]} receiveShadow scale={[1.8, 0.12, 0.85]}>
        <sphereGeometry args={[0.42, 24, 16]} />
        <meshStandardMaterial color={BIOLOGY_COLORS.leaf} roughness={0.65} />
      </mesh>
      <ThreeLabel
        anchorX="right"
        color={ink}
        gap={0.04}
        position={[-0.78, 0.14, 0.16]}
      >
        {parts.leaf}
      </ThreeLabel>

      {/* Developing insect on leaf */}
      <group position={[0, 0.2, 0.16]} scale={bodyScale}>
        {snap.stage === "egg" && (
          <mesh castShadow>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color={BIOLOGY_COLORS.seed} />
          </mesh>
        )}

        {(snap.stage === "nymph" || snap.stage === "larva") && (
          <group>
            {/* Segmented body + hard chitin head capsule */}
            {Arr.map([-0.18, -0.04, 0.1, 0.22] as const, (x) => (
              <mesh castShadow key={x} position={[x, 0, 0]}>
                <sphereGeometry args={[0.095, 16, 16]} />
                <meshStandardMaterial
                  color={
                    insect === "grasshopper"
                      ? BIOLOGY_COLORS.coleoptile
                      : PLOT_COLORS.amber
                  }
                />
              </mesh>
            ))}
            <mesh castShadow position={[0.34, 0.02, 0]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.cork} />
            </mesh>
            {insect === "grasshopper" && snap.instar >= 3 && (
              <mesh position={[0.08, 0.1, 0]} rotation={[0, 0, -0.3]}>
                <boxGeometry args={[0.14, 0.03, 0.16]} />
                <meshStandardMaterial color={BIOLOGY_COLORS.leafUnder} />
              </mesh>
            )}
          </group>
        )}

        {snap.stage === "pupa" && (
          <mesh
            castShadow
            position={[0, 0.06, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <capsuleGeometry args={[0.11, 0.24, 10, 18]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.boxwood}
              roughness={0.55}
            />
          </mesh>
        )}

        {snap.stage === "adult" && (
          <group>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <capsuleGeometry args={[0.075, 0.34, 10, 18]} />
              <meshStandardMaterial
                color={
                  insect === "grasshopper"
                    ? BIOLOGY_COLORS.stem
                    : BIOLOGY_COLORS.microscopeBlack
                }
              />
            </mesh>
            {/* Wings */}
            {Arr.map([-1, 1] as const, (side) => (
              <mesh
                castShadow
                key={side}
                position={[0, 0.14, side * 0.22]}
                rotation={[side * 0.55, 0, 0]}
              >
                <boxGeometry args={[0.36, 0.02, 0.32]} />
                <meshStandardMaterial
                  color={
                    insect === "grasshopper"
                      ? BIOLOGY_COLORS.leafUnder
                      : PLOT_COLORS.orange
                  }
                  opacity={0.85}
                  transparent
                />
              </mesh>
            ))}
          </group>
        )}
      </group>

      {/* Shed old exoskeleton (exuvia) beside insect during moults */}
      {snap.shedding && (
        <group position={[-0.45, 0.16, 0.22]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.055, 0.16, 8, 12]} />
            <meshStandardMaterial
              color={BIOLOGY_COLORS.bean}
              opacity={0.55}
              transparent
            />
          </mesh>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.04}
            position={[0, 0.12, 0]}
          >
            {parts.exuvia}
          </ThreeLabel>
        </group>
      )}
    </group>
  );
}
