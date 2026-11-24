import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type {
  Specimen,
  Version,
} from "@repo/design-system/components/contents/biology/drawing/scale";
import {
  cellOutline,
  drawingScale,
  leaderLines,
  strokeProgress,
} from "@repo/design-system/components/contents/biology/drawing/scale";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0.02, 1.38, 1.05];
const CAMERA_TARGET: readonly [number, number, number] = [0.02, 0.02, 0.02];

/**
 * Split bench scene: left side is a circular illuminated microscope field of
 * view showing a stained cheek or onion cell; right side is an A4 drawing
 * sheet showing a live-scaled pencil biological drawing and its rule faults.
 */
export function DrawingScene({
  boundaryLabel,
  cytoplasmLabel,
  drawingMax,
  drawingMin,
  drawingMm,
  magnificationText,
  nucleusLabel,
  specimen,
  version,
}: {
  readonly boundaryLabel: string;
  readonly cytoplasmLabel: string;
  readonly drawingMax: number;
  readonly drawingMin: number;
  readonly drawingMm: number;
  readonly magnificationText?: string | undefined;
  readonly nucleusLabel: string;
  readonly specimen: Specimen;
  readonly version: Version;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(3.6);
  const [progress, setProgress] = useState(1);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current += simulationStep(delta);
    setProgress(strokeProgress(clock.current));
  });

  const scale = drawingScale(drawingMm, drawingMin, drawingMax);
  const faulty = version === "faulty";

  const outlineGeo = useMemo(() => {
    const pts = cellOutline(specimen, scale);
    const visible = Math.max(
      2,
      Math.round(pts.length * (playing ? progress : 1))
    );
    const geometry = new BufferGeometry();
    geometry.setFromPoints(
      Arr.map(Arr.take(pts, visible), ([x, y, z]) => new Vector3(x, y, z))
    );
    return geometry;
  }, [playing, progress, scale, specimen]);

  const sketchyGeo = useMemo(() => {
    const pts = cellOutline(specimen, scale * 1.05, 0.012);
    const geometry = new BufferGeometry();
    geometry.setFromPoints(Arr.map(pts, ([x, y, z]) => new Vector3(x, y, z)));
    return geometry;
  }, [scale, specimen]);

  const hatchGeo = useMemo(() => {
    const lines = Arr.makeBy(7, (index) => {
      const offset = (-0.12 + index * 0.04) * scale;
      return [
        new Vector3(offset - 0.06 * scale, 0.007, -0.08 * scale),
        new Vector3(offset + 0.06 * scale, 0.007, 0.08 * scale),
      ];
    });
    const geometry = new BufferGeometry();
    geometry.setFromPoints(Arr.flatten(lines));
    return geometry;
  }, [scale]);

  const leaders = useMemo(() => leaderLines(scale, faulty), [faulty, scale]);

  const leaderGeo = useMemo(() => {
    const points = Arr.flatten(
      Arr.map(leaders, (line) => [
        new Vector3(line.start[0], line.start[1], line.start[2]),
        new Vector3(line.end[0], line.end[1], line.end[2]),
      ])
    );
    const geometry = new BufferGeometry();
    geometry.setFromPoints(points);
    return geometry;
  }, [leaders]);

  useEffect(
    () => () => {
      outlineGeo.dispose();
      sketchyGeo.dispose();
      hatchGeo.dispose();
      leaderGeo.dispose();
    },
    [hatchGeo, leaderGeo, outlineGeo, sketchyGeo]
  );

  const labelFor = (part: "nucleus" | "cytoplasm" | "boundary") =>
    Match.value(part).pipe(
      Match.when("nucleus", () => nucleusLabel),
      Match.when("cytoplasm", () => cytoplasmLabel),
      Match.when("boundary", () => boundaryLabel),
      Match.exhaustive
    );

  return (
    <group>
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={36}
      />

      {/* Bench top */}
      <mesh position={[0, -0.025, 0]} receiveShadow>
        <boxGeometry args={[1.65, 0.05, 0.96]} />
        <meshStandardMaterial
          color={LABORATORY_COLORS.worktop}
          roughness={0.65}
        />
      </mesh>

      {/* Left: illuminated microscope field of view */}
      <group position={[-0.42, 0.004, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[0.31, 0.31, 0.012, 40]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.microscopeBlack}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.007, 0]}>
          <cylinderGeometry args={[0.275, 0.275, 0.006, 40]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.paper}
            emissive={LABORATORY_COLORS.spot}
            emissiveIntensity={0.25}
          />
        </mesh>
        {specimen === "onion" ? (
          <group position={[0, 0.013, 0]}>
            <mesh>
              <boxGeometry args={[0.34, 0.006, 0.19]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.onionWall}
                roughness={0.6}
              />
            </mesh>
            <mesh position={[0, 0.002, 0]}>
              <boxGeometry args={[0.305, 0.006, 0.155]} />
              <meshStandardMaterial
                color={BIOLOGY_COLORS.onionCell}
                roughness={0.5}
              />
            </mesh>
            <mesh position={[-0.06, 0.006, -0.02]}>
              <cylinderGeometry args={[0.028, 0.028, 0.005, 20]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.onionNucleus} />
            </mesh>
          </group>
        ) : (
          <group position={[0, 0.013, 0]}>
            <mesh scale={[1.1, 1, 0.88]}>
              <cylinderGeometry args={[0.165, 0.165, 0.006, 28]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.methyleneBlue} />
            </mesh>
            <mesh position={[0, 0.002, 0]} scale={[1.04, 1, 0.82]}>
              <cylinderGeometry args={[0.155, 0.155, 0.006, 28]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.cheekCell} />
            </mesh>
            <mesh position={[-0.015, 0.006, -0.01]}>
              <cylinderGeometry args={[0.036, 0.036, 0.005, 20]} />
              <meshStandardMaterial color={BIOLOGY_COLORS.methyleneDark} />
            </mesh>
          </group>
        )}
      </group>

      {/* Right: A4 drawing sheet + pencil drawing + ruler */}
      <group position={[0.3, 0.004, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.92, 0.008, 0.68]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.paper}
            roughness={0.85}
          />
        </mesh>

        {/* Drawing shifted slightly left of centre to leave room for right labels */}
        <group position={[-0.1, 0, 0]}>
          <lineLoop geometry={outlineGeo}>
            <lineBasicMaterial color={LABORATORY_COLORS.pencil} />
          </lineLoop>

          {/* Nucleus circle on paper */}
          <mesh
            position={[-0.02 * scale, 0.006, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.024 * scale, 0.032 * scale, 24]} />
            <meshBasicMaterial color={LABORATORY_COLORS.pencil} />
          </mesh>

          {/* Faulty drawing errors: doubled sketchy line + shading cross-hatching */}
          {faulty && (
            <group>
              <lineLoop geometry={sketchyGeo}>
                <lineBasicMaterial color={PLOT_COLORS.pink} />
              </lineLoop>
              <lineSegments geometry={hatchGeo}>
                <lineBasicMaterial color={PLOT_COLORS.pink} />
              </lineSegments>
            </group>
          )}

          {/* Label leader lines */}
          <lineSegments geometry={leaderGeo}>
            <lineBasicMaterial
              color={faulty ? PLOT_COLORS.pink : LABORATORY_COLORS.pencil}
            />
          </lineSegments>

          {/* Arrowheads (forbidden in biological drawings!) shown only when faulty */}
          {faulty &&
            Arr.map(leaders, (line) => (
              <mesh
                key={line.part}
                position={line.start}
                rotation={[0, 0, Math.PI / 2]}
              >
                <coneGeometry args={[0.014, 0.034, 8]} />
                <meshStandardMaterial color={PLOT_COLORS.pink} />
              </mesh>
            ))}

          {/* Part labels along right margin */}
          {Arr.map(leaders, (line) => (
            <ThreeLabel
              anchorX="left"
              color={ink}
              gap={0.01}
              key={line.part}
              position={[line.end[0] + 0.02, 0.02, line.end[2]]}
            >
              {labelFor(line.part)}
            </ThreeLabel>
          ))}
        </group>

        {/* Scale ruler bar showing active drawing length */}
        <mesh position={[-0.1, 0.007, 0.25]}>
          <boxGeometry args={[0.42 * scale, 0.004, 0.03]} />
          <meshStandardMaterial
            color={BIOLOGY_COLORS.boxwood}
            roughness={0.6}
          />
        </mesh>
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.01}
          position={[-0.1, 0.02, 0.28]}
        >
          {`${drawingMm} mm`}
        </ThreeLabel>

        {/* Title & magnification line on paper (absent in faulty drawing) */}
        {!faulty && magnificationText !== undefined && (
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.01}
            position={[0, 0.02, -0.26]}
          >
            {magnificationText}
          </ThreeLabel>
        )}
      </group>
    </group>
  );
}
