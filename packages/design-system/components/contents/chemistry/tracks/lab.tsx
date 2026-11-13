import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  type ParticleId,
  ParticleIdSchema,
  trackPoints,
  trackRadius,
} from "@repo/design-system/components/contents/chemistry/tracks/motion";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  useVisualScene,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { createRef, type ReactNode, Suspense, useMemo, useState } from "react";
import { Color, type Mesh } from "three";
import { useFormatter } from "use-intl";

/** How many scene units one metre of the chamber spans. */
const METRE = 30;

/** The half width of the chamber's field of view, in metres. */
const HALF_WIDTH = 0.12;

/** The field strengths the slider reaches, in tesla. */
const FIELD = { max: 0.1, min: 0.0001 } as const;

/** Each particle's track color and the height it enters at, in metres. */
const LANES = {
  electron: { color: PLOT_COLORS.teal, y: 0.06 },
  neutron: { color: PLOT_COLORS.slate, y: 0 },
  proton: { color: PLOT_COLORS.amber, y: -0.06 },
} as const;

/** The words a track lab reads from its lesson. */
interface TrackLabels {
  /** The readout of the electron's radius. */
  readonly electron: ReactNode;
  /** The name of the field slider and its readout. */
  readonly field: string;
  /** The readout of the proton's radius. */
  readonly proton: ReactNode;
  /** The readout of the ratio of the radii, the ratio of the masses. */
  readonly ratio: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * An electron, a proton and a neutron enter a magnetic field side by side at
 * the same speed. The charged ones circle, on radii r = m v / (q B): the
 * electron curls one way in a tight loop, the proton, 1836 times heavier,
 * bends gently the other way, and the neutron, with no charge, flies straight.
 * Strengthen the field and every loop tightens.
 */
export function ParticleTrackLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: TrackLabels;
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const [field, setField] = useState(0.0005);
  const science = (value: number) => {
    const [mantissa, exponent] = format
      .number(value, { maximumFractionDigits: 2, notation: "scientific" })
      .split("E");
    return `${(mantissa ?? "").replaceAll(",", "{,}")} \\times 10^{${exponent ?? ""}}`;
  };
  const decimal = (value: number, digits: number) =>
    format
      .number(value, { maximumFractionDigits: digits, useGrouping: false })
      .replaceAll(",", "{,}");

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.field}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath
                math={`B = ${decimal(field * 1000, 1)}\\ \\mathrm{mT}`}
              />
            </span>
          </div>
          <Slider
            aria-label={labels.field}
            max={FIELD.max}
            min={FIELD.min}
            onValueChange={(value: number) => setField(value)}
            step={0.0001}
            value={field}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={HALF_WIDTH * METRE + 1} setting="space">
          <Suspense>
            <TrackCamera />
            <Chamber field={field} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.field}
            value={
              <InlineMath
                math={`B = ${decimal(field * 1000, 1)}\\ \\mathrm{mT}`}
              />
            }
          />
          <VisualFact
            label={labels.electron}
            value={
              <InlineMath
                math={`r_e = ${science(trackRadius("electron", field))}\\ \\mathrm{m}`}
              />
            }
          />
          <VisualFact
            label={labels.proton}
            value={
              <InlineMath
                math={`r_p = ${science(trackRadius("proton", field))}\\ \\mathrm{m}`}
              />
            }
          />
          <VisualFact
            label={labels.ratio}
            value={
              <InlineMath
                math={`\\dfrac{r_p}{r_e} = \\dfrac{m_p}{m_e} = ${decimal(trackRadius("proton", field) / trackRadius("electron", field), 0)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The chamber's glass box, the three tracks drawn as glowing trails, and a
 * bead on each track that travels it while the card plays.
 */
function Chamber({ field }: { readonly field: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const tracks = useMemo(
    () =>
      Arr.map(ParticleIdSchema.literals, (id: ParticleId) => {
        const lane = LANES[id];
        const points = Arr.map(
          trackPoints(id, field, 2.5, 2 * HALF_WIDTH, 1600),
          ([x, y]) =>
            [(x - HALF_WIDTH) * METRE, (y + lane.y) * METRE, 0] as const
        );
        return {
          color: new Color(lane.color).multiplyScalar(1.8),
          id,
          points,
          ref: createRef<Mesh>(),
        };
      }),
    [field]
  );

  useFrame((state) => {
    const share = playing ? (state.clock.elapsedTime / 3) % 1 : 1;
    for (const track of tracks) {
      const point = Arr.get(
        track.points,
        Math.floor(share * (track.points.length - 1))
      );
      if (point._tag === "Some" && track.ref.current !== null) {
        track.ref.current.position.set(point.value[0], point.value[1], 0);
      }
    }
  });

  return (
    <group>
      <mesh>
        <boxGeometry
          args={[
            2 * HALF_WIDTH * METRE + 0.6,
            2 * HALF_WIDTH * METRE + 0.6,
            1.4,
          ]}
        />
        <GlassMaterial color={getColor("SLATE", 300)} opacity={0.08} />
      </mesh>
      {Arr.map(tracks, (track) => (
        <group key={track.id}>
          {track.points.length > 1 ? (
            <Line
              color={track.color}
              lineWidth={track.id === "neutron" ? 1 : 1.8}
              opacity={track.id === "neutron" ? 0.5 : 0.9}
              points={track.points}
              toneMapped={false}
              transparent
            />
          ) : null}
          <mesh ref={track.ref}>
            <sphereGeometry args={[0.09, 14, 10]} />
            <meshBasicMaterial color={track.color} toneMapped={false} />
          </mesh>
          <ThreeLabel
            color={getColor("SLATE", 300)}
            fontSize="compact"
            position={[-HALF_WIDTH * METRE - 0.8, LANES[track.id].y * METRE, 0]}
          >
            <InlineMath
              math={
                { electron: "e^-", neutron: "n^0", proton: "p^+" }[track.id]
              }
            />
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}

/** Faces the chamber straight on, farther back on a narrow card. */
function TrackCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 13 : 10;
  return (
    <CameraControls
      cameraPosition={[0, 0.8, distance]}
      cameraTarget={[0, 0, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={3}
    />
  );
}
