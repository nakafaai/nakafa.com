import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  CompoundMicroscope,
  GraphitePencil,
  IlluminatedEyepieceInset,
  useDrawingPaperTexture,
} from "@repo/design-system/components/contents/biology/drawing/apparatus";
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
import { GraduatedRuler } from "@repo/design-system/components/contents/biology/fixtures";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { LABORATORY_COLORS } from "@repo/design-system/lib/material/laboratory";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Match } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BufferGeometry, Vector3 } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0.06, 1.5, 1.38];
const CAMERA_TARGET: readonly [number, number, number] = [0.04, 0.08, 0.02];

/**
 * Photorealistic microscopy and biological drawing bench: brass/enamel compound
 * light microscope + illuminated stained cell inset on the left; cotton-rag A4
 * drawing sheet, graphite pencil, graduated wooden ruler, and live-scaled
 * biological drawing on the right.
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
  const paperTex = useDrawingPaperTexture();
  const clock = useRef(3.6);
  const [progress, setProgress] = useState(1);

  const rewind = useCallback(() => {
    clock.current = 3.6;
    setProgress(1);
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

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
      <SimulationTicker running={playing} />
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={36}
      />
      <SeamlessBenchSurface radius={12} y={0} />

      {/* Left rear: realistic brass and enamel compound light microscope */}
      <CompoundMicroscope position={[-0.64, 0, -0.22]} specimen={specimen} />

      {/* Left front: illuminated stained eyepiece field-of-view inset */}
      <IlluminatedEyepieceInset
        position={[-0.44, 0.011, 0.16]}
        specimen={specimen}
      />

      {/* Right: cotton-rag A4 scientific drawing sheet + pencil + graduated wooden ruler */}
      <group position={[0.32, 0.005, 0.02]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.92, 0.008, 0.68]} />
          <meshStandardMaterial
            color={LABORATORY_COLORS.paper}
            map={paperTex}
            roughness={0.86}
          />
        </mesh>

        <GraphitePencil position={[0.34, 0.012, 0.24]} />

        <group position={[-0.1, 0, 0]}>
          <lineLoop geometry={outlineGeo}>
            <lineBasicMaterial color={LABORATORY_COLORS.pencil} />
          </lineLoop>

          {/* Clean single-line nucleus on drawing sheet */}
          <mesh
            position={[-0.02 * scale, 0.006, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.024 * scale, 0.032 * scale, 28]} />
            <meshBasicMaterial color={LABORATORY_COLORS.pencil} />
          </mesh>

          {faulty ? (
            <group>
              <lineLoop geometry={sketchyGeo}>
                <lineBasicMaterial color={PLOT_COLORS.pink} />
              </lineLoop>
              <lineSegments geometry={hatchGeo}>
                <lineBasicMaterial color={PLOT_COLORS.pink} />
              </lineSegments>
            </group>
          ) : null}

          <lineSegments geometry={leaderGeo}>
            <lineBasicMaterial
              color={faulty ? PLOT_COLORS.pink : LABORATORY_COLORS.pencil}
            />
          </lineSegments>

          {faulty
            ? Arr.map(leaders, (line) => (
                <mesh
                  key={line.part}
                  position={line.start}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <coneGeometry args={[0.014, 0.034, 10]} />
                  <meshStandardMaterial color={PLOT_COLORS.pink} />
                </mesh>
              ))
            : null}

          {Arr.map(leaders, (line) => (
            <ThreeLabel
              anchorX="left"
              color={ink}
              gap={0.01}
              key={line.part}
              position={[line.end[0] + 0.02, 0.022, line.end[2]]}
            >
              {labelFor(line.part)}
            </ThreeLabel>
          ))}
        </group>

        {/* Graduated boxwood scale ruler lying flat on the drawing sheet */}
        <GraduatedRuler
          height={0.44 * scale}
          position={[-0.1, 0.012, 0.24]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
          width={0.042}
        />
        <ThreeLabel
          anchorY="top"
          color={ink}
          gap={0.01}
          position={[-0.1, 0.024, 0.285]}
        >
          {`${drawingMm} mm`}
        </ThreeLabel>

        {!faulty && magnificationText !== undefined ? (
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.01}
            position={[0, 0.024, -0.265]}
          >
            {magnificationText}
          </ThreeLabel>
        ) : null}
      </group>
    </group>
  );
}
