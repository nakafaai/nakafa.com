import { useFrame, useThree } from "@react-three/fiber";
import type {
  DrawRule,
  MarbleColor,
  Trial,
} from "@repo/design-system/components/contents/mathematics/marble/draw";
import {
  jarSlots,
  MARBLE_RADIUS,
  mixedSlots,
  pileTop,
} from "@repo/design-system/components/contents/mathematics/marble/jar";
import {
  DISH_AT,
  firstPlace,
  JAR_AT,
  LID_AT,
  secondPlace,
  slotAt,
  surfaceAt,
} from "@repo/design-system/components/contents/mathematics/marble/path";
import type { TallyUpdate } from "@repo/design-system/components/contents/mathematics/marble/props";
import {
  JarLid,
  MarbleDish,
  MarbleJar,
  TALLY_COLUMNS,
  TallyBoard,
} from "@repo/design-system/components/contents/mathematics/marble/props";
import {
  RUN_SECONDS,
  runMoment,
  STEPS,
} from "@repo/design-system/components/contents/mathematics/marble/run";
import { swirlShares } from "@repo/design-system/components/contents/mathematics/marble/swirl";
import { StudioTable } from "@repo/design-system/components/contents/mathematics/table";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { MARBLE_COLORS } from "@repo/design-system/lib/material/marble";
import { Array as Arr, Option, Record as Rec } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Mesh } from "three";
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshPhysicalMaterial,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
} from "three";

/** The seed of the jar's mix, so every learner sees the same jar. */
const MIX_SEED = 20_261_120;

/** How long the scene waits between two reports of the trials finished, in seconds. */
const REPORT_EVERY = 0.1;

/**
 * The marble jar on an oak table: the jar of mixed marbles with its lid
 * beside it, a dish for a marble kept out, and a tally board whose pegs
 * record the colours of the last trials. Playing runs the trials: the first
 * few marble by marble, the rest quickly, and the scene reports how many
 * have finished.
 */
export function MarbleScene({
  jar,
  onFinished,
  rule,
  trials,
}: {
  readonly jar: readonly MarbleColor[];
  readonly onFinished: (finished: number) => void;
  readonly rule: DrawRule;
  readonly trials: readonly Trial[];
}) {
  const { advance, playing } = useTimeline(0, RUN_SECONDS);
  const slots = useMemo(() => {
    const places = jarSlots(jar.length);
    return Arr.map(mixedSlots(jar.length, MIX_SEED), (slot) =>
      Arr.getUnsafe(places, slot)
    );
  }, [jar.length]);
  const top = pileTop(slots);
  const places = useMemo(
    () => Arr.map(jar, (color, place) => ({ color, place })),
    [jar]
  );
  const geometry = useMemo(() => new SphereGeometry(MARBLE_RADIUS, 40, 28), []);
  const materials = useMemo(
    () =>
      Rec.map(
        { blue: 0, green: 0, red: 0, white: 0, yellow: 0 },
        (_, color: MarbleColor) =>
          new MeshPhysicalMaterial({
            clearcoat: 1,
            clearcoatRoughness: 0.02,
            ior: 1.52,
            map: swirlTexture(MARBLE_COLORS[color]),
            roughness: 0.08,
            specularIntensity: 1,
          })
      ),
    []
  );
  useEffect(
    () => () => {
      Arr.forEach(Rec.values(materials), (material) => {
        material.map?.dispose();
        material.dispose();
      });
    },
    [materials]
  );
  const pegs = useMemo(
    () =>
      Rec.map(
        { blue: 0, green: 0, red: 0, white: 0, yellow: 0 },
        (_, color: MarbleColor) =>
          new MeshPhysicalMaterial({
            clearcoat: 0.8,
            clearcoatRoughness: 0.15,
            color: MARBLE_COLORS[color],
            roughness: 0.3,
          })
      ),
    []
  );
  useEffect(
    () => () => {
      Arr.forEach(Rec.values(pegs), (material) => material.dispose());
    },
    [pegs]
  );
  const marbles = useRef<(Mesh | null)[]>([]);
  const tally = useRef<TallyUpdate>(null);
  const reported = useRef({ at: 0, finished: -1 });

  useFrame((state, delta) => {
    const time = advance(delta);
    const moment = runMoment(time);
    const active = Option.getOrUndefined(moment.active);
    const trial = active === undefined ? undefined : trials[active.trial];
    Arr.forEach(slots, (slot, index) => {
      const mesh = marbles.current[index];
      if (!mesh) {
        return;
      }
      mesh.position.copy(slotAt(slot));
    });
    if (active !== undefined && trial !== undefined) {
      const first = marbles.current[trial.first];
      const second = marbles.current[trial.second];
      const firstSlot = Arr.getUnsafe(slots, trial.first);
      const secondSlot = Arr.getUnsafe(slots, trial.second);
      first?.position.copy(
        firstPlace(
          active.elapsed,
          rule,
          surfaceAt(firstSlot, top),
          slotAt(firstSlot)
        )
      );
      if (trial.second !== trial.first) {
        second?.position.copy(
          secondPlace(
            active.elapsed,
            surfaceAt(secondSlot, top),
            slotAt(secondSlot)
          )
        );
      }
    }
    const read =
      active === undefined
        ? 0
        : Number(active.elapsed >= STEPS.firstRead) +
          Number(active.elapsed >= STEPS.secondRead);
    tally.current?.(moment.finished, read);
    const now = state.clock.elapsedTime;
    if (
      moment.finished !== reported.current.finished &&
      (now - reported.current.at >= REPORT_EVERY || !playing)
    ) {
      reported.current = { at: now, finished: moment.finished };
      onFinished(moment.finished);
    }
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MarbleCamera />
      <Table />
      <group position={JAR_AT}>
        <MarbleJar />
      </group>
      <group position={LID_AT}>
        <JarLid />
      </group>
      <group position={DISH_AT}>
        <MarbleDish />
      </group>
      {Arr.map(places, (marble) => (
        <mesh
          castShadow
          geometry={geometry}
          key={marble.place}
          material={materials[marble.color]}
          ref={(mesh) => {
            marbles.current[marble.place] = mesh;
          }}
        />
      ))}
      <TallyBoard
        colors={Arr.map(trials, (trial) => ({
          first: Arr.getUnsafe(jar, trial.first),
          second: Arr.getUnsafe(jar, trial.second),
        }))}
        columns={TALLY_COLUMNS}
        materials={pegs}
        ref={tally}
      />
    </group>
  );
}

/** The side of a marble's swirl image, in pixels round the marble; half as many run pole to pole. */
const SWIRL_PIXELS = 256;

/**
 * The glass of one marble as an image wrapped round it: its own colour with
 * ribbons of white glass, tinted a little by the colour they were twisted
 * through, wound from pole to pole.
 */
function swirlTexture(color: string) {
  const own = new Color(color);
  const ribbon = new Color(MARBLE_COLORS.ribbon).lerp(own, 0.12);
  const shares = swirlShares(SWIRL_PIXELS, SWIRL_PIXELS / 2);
  const data = new Uint8Array(shares.length * 4);
  const mixed = new Color();
  shares.forEach((share, index) => {
    mixed.copy(own).lerp(ribbon, share).convertLinearToSRGB();
    data.set(
      [
        Math.round(mixed.r * 255),
        Math.round(mixed.g * 255),
        Math.round(mixed.b * 255),
        255,
      ],
      index * 4
    );
  });
  const texture = new DataTexture(data, SWIRL_PIXELS, SWIRL_PIXELS / 2);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** The oak tabletop the jar stands on, planked and oiled, its top at y = 0. */
function Table() {
  return <StudioTable color={MARBLE_COLORS.oak} />;
}

/** Looks at the jar, the dish and the tally board from the front and above, farther back on a narrow card. */
function MarbleCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.5 : 0.44;
  return (
    <CameraControls
      cameraPosition={[0.02, 0.1 + distance * 0.55, 0.06 + distance]}
      cameraTarget={[0.01, 0.06, 0.03]}
      fov={36}
      maxDistance={distance * 2}
      minDistance={0.15}
    />
  );
}
