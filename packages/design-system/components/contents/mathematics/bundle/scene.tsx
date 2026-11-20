import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  MOST_STICKS,
  placeDigits,
  placeValueMath,
  stepMath,
} from "@repo/design-system/components/contents/mathematics/bundle/digits";
import { deskFrame } from "@repo/design-system/components/contents/mathematics/bundle/frame";
import {
  boxPanels,
  HEAP,
  trayPanels,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  BandRubber,
  Desk,
  KraftCard,
  PanelSet,
  placePanels,
  StickWood,
  TrayBeech,
  useBandGeometry,
  useStickGeometry,
} from "@repo/design-system/components/contents/mathematics/bundle/props";
import {
  boxesAt,
  planRun,
  roundIndexAt,
  stickAt,
  tiedBundlesAt,
  traysAt,
} from "@repo/design-system/components/contents/mathematics/bundle/staging";
import { LABEL_Z } from "@repo/design-system/components/contents/mathematics/bundle/zones";
import { seededUniforms } from "@repo/design-system/components/contents/mathematics/chance";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { THREE_DIAGRAM_MINIMUM_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Array as Arr, Option } from "effect";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, type InstancedMesh, Object3D } from "three";

/** The most bundles, boxes and trays the desk ever holds at once. */
const MOST = { boxes: 16, bundles: MOST_STICKS / 2, trays: 4 } as const;

/** How many pixels a zone needs to label its place with both the power and its worth in base ten. */
const ROOMY_ZONE = 130;

/**
 * How tall the labels' letters stand on the desk, in metres, as a card
 * printed for the desk would letter them: the camera frames the labels at
 * this size, and on screen they keep between 14 and 22 pixels.
 */
const LABEL_SIZE = { digit: 0.026, power: 0.022 } as const;

/** The seed of each stick's shade, so the birch varies the same way for every learner. */
const SHADE_SEED = 1904;

/**
 * The bundling desk: a heap of `count` ice-cream sticks in front of the
 * zones of the places of `base`. Before play, and at the end of every run,
 * the desk shows the count bundled: trays, boxes, bundles and loose sticks,
 * each zone labelled with what one of its things is worth. Playing tips the
 * sticks out and acts out the rounds of division. With `showReadout`, a
 * caption reads each round's division while it plays, and each zone shows
 * its digit.
 */
export function BundleScene({
  base,
  count,
  showReadout,
}: {
  readonly base: number;
  readonly count: number;
  readonly showReadout: boolean;
}) {
  const run = useMemo(() => planRun(count, base), [base, count]);
  const { advance, playing } = useTimeline(0, run.duration);
  const ink = useLabelInk();
  const stickGeometry = useStickGeometry();
  const bandGeometry = useBandGeometry(base);
  const sticks = useRef<InstancedMesh>(null);
  const bands = useRef<InstancedMesh>(null);
  const boxMeshes = useRef<(InstancedMesh | null)[]>([]);
  const trayMeshes = useRef<(InstancedMesh | null)[]>([]);
  const dummy = useMemo(() => {
    const object = new Object3D();
    object.rotation.order = "YXZ";
    return object;
  }, []);
  const boxes = useMemo(() => boxPanels(base), [base]);
  const trays = useMemo(() => trayPanels(base), [base]);
  const [round, setRound] = useState(-1);
  const [inRun, setInRun] = useState(false);
  const frame = useMemo(
    () => deskFrame(count, base, inRun),
    [base, count, inRun]
  );
  const digits = placeDigits(count, base);
  const width = useThree((state) => state.size.width);

  // Each stick takes its own shade of birch, as real sticks do.
  useLayoutEffect(() => {
    const mesh = sticks.current;
    if (!mesh) {
      return;
    }
    const shade = new Color();
    Arr.forEach(seededUniforms(SHADE_SEED, MOST_STICKS), (value, stick) => {
      const tone = 0.86 + 0.2 * value;
      mesh.setColorAt(stick, shade.setRGB(tone, tone, tone));
    });
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, []);

  useFrame((_, delta) => {
    const time = advance(delta);
    const stickMesh = sticks.current;
    const bandMesh = bands.current;
    if (!(stickMesh && bandMesh)) {
      return;
    }
    Arr.forEach(Arr.range(0, count - 1), (stick) => {
      const { at, heap, straight } = stickAt(run, stick, time);
      dummy.position.set(at.x, at.y, at.z);
      dummy.rotation.set(
        heap.tilt * (1 - straight),
        heap.yaw * (1 - straight),
        0
      );
      dummy.updateMatrix();
      stickMesh.setMatrixAt(stick, dummy.matrix);
    });
    stickMesh.count = count;
    stickMesh.instanceMatrix.needsUpdate = true;

    const tied = tiedBundlesAt(run, time);
    Arr.forEach(tied, (at, slot) => {
      dummy.position.set(at.x, at.y, at.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bandMesh.setMatrixAt(slot, dummy.matrix);
    });
    bandMesh.count = tied.length;
    bandMesh.instanceMatrix.needsUpdate = true;
    placePanels(boxMeshes.current, boxes, boxesAt(run, time), dummy);
    placePanels(trayMeshes.current, trays, traysAt(run, time), dummy);

    const now = playing
      ? Option.getOrElse(roundIndexAt(run, time), () => -1)
      : -1;
    if (now !== round) {
      setRound(now);
    }
    const running = playing || time < run.duration;
    if (running !== inRun) {
      setInRun(running);
    }
  });

  const caption = Arr.get(run.rounds, round);
  const roomy = width / run.length >= ROOMY_ZONE;

  return (
    <group>
      <SimulationTicker running={playing} />
      <BundleCamera />
      <CameraBounds exclude>
        <Desk />
      </CameraBounds>
      <CameraBounds bounds={frame}>
        <instancedMesh
          args={[stickGeometry, undefined, MOST_STICKS]}
          castShadow
          frustumCulled={false}
          receiveShadow
          ref={sticks}
        >
          <StickWood />
        </instancedMesh>
        <instancedMesh
          args={[bandGeometry, undefined, MOST.bundles]}
          frustumCulled={false}
          ref={bands}
        >
          <BandRubber />
        </instancedMesh>
        <PanelSet capacity={MOST.boxes} meshes={boxMeshes} panels={boxes}>
          <KraftCard />
        </PanelSet>
        <PanelSet capacity={MOST.trays} meshes={trayMeshes} panels={trays}>
          <TrayBeech />
        </PanelSet>
      </CameraBounds>
      {Arr.map(run.zones, (zone, place) => (
        <group key={zone.x} position={[zone.x, 0, LABEL_Z]}>
          <ThreeLabel
            color={ink}
            fontSize={LABEL_SIZE.power}
            minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
            position={[0, 0.001, 0]}
          >
            <InlineMath math={placeValueMath(place, base, roomy)} />
          </ThreeLabel>
          {showReadout ? (
            <ThreeLabel
              anchorY="top"
              color={ink}
              fontSize={LABEL_SIZE.digit}
              gap={0.012}
              minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
              position={[0, 0.001, 0]}
            >
              <InlineMath math={String(Arr.getUnsafe(digits, place))} />
            </ThreeLabel>
          ) : null}
        </group>
      ))}
      {showReadout && Option.isSome(caption) ? (
        <ThreeLabel
          color={ink}
          fontSize={LABEL_SIZE.digit}
          minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
          position={[HEAP.x, 0.1, HEAP.z]}
        >
          <InlineMath math={stepMath(caption.value.step, base)} />
        </ThreeLabel>
      ) : null}
    </group>
  );
}

/** How far the camera may swing round either side of the front, in radians. */
const TURN_LIMIT = 0.5;

/** How steeply the camera looks down at the desk, in radians, so every box and bundle shows its top. */
const ELEVATION = 1.02;

/**
 * Looks down at the desk from in front and above, steeply enough that
 * stacked bundles and open boxes show their tops. The camera keeps that
 * angle and fits its distance and aim to the frame the scene declares, with
 * the zone labels, on a card of any shape.
 */
function BundleCamera() {
  return (
    <CameraControls
      cameraPosition={[0, Math.sin(ELEVATION), Math.cos(ELEVATION)]}
      cameraTarget={[0, 0, 0]}
      fov={36}
      framing="content"
      maxAzimuthAngle={TURN_LIMIT}
      maxPolarAngle={Math.PI / 2 - 0.08}
      minAzimuthAngle={-TURN_LIMIT}
      minDistance={0.25}
    />
  );
}
