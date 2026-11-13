import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { toggleColumns } from "@repo/design-system/components/contents/chemistry/columns";
import {
  averageMass,
  getSample,
  pathRadius,
  type SampleId,
  SampleIdSchema,
} from "@repo/design-system/components/contents/chemistry/spectrometer/isotopes";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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
import { Array as Arr, Option, Schema } from "effect";
import { createRef, type ReactNode, Suspense, useMemo, useState } from "react";
import { Color, DoubleSide, type Mesh } from "three";
import { useFormatter } from "use-intl";

/** The path radius of an ion of mass 20, in scene units; heavier ions turn wider. */
const BASE_RADIUS = 5;

/** The mass every path radius is measured against. */
const BASE_MASS = 20;

/** How tall a peak of the whole sample would stand, in scene units. */
const PEAK = 5.5;

/** The colors of the isotopes' beams and peaks, lightest first. */
const BEAMS = [
  PLOT_COLORS.teal,
  PLOT_COLORS.amber,
  PLOT_COLORS.violet,
] as const;

/** How long an ion takes around its half circle while the card plays, in seconds. */
const FLIGHT = 2.4;

/** The words a mass spectrometer lab reads from its lesson. */
interface SpectrometerLabels {
  /** The readout of the average atomic mass. */
  readonly average: ReactNode;
  /** The name of the toggle that chooses a sample, for assistive technology. */
  readonly choose: string;
  /** The readout of the isotopes and their shares. */
  readonly isotopes: ReactNode;
  /** The readout of how the path radius follows the mass. */
  readonly radius: ReactNode;
  /** The readout of the ratio of the outer and inner paths. */
  readonly ratio: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * A magnetic sector mass spectrometer: ions of one element leave the source
 * at the same speed per charge, the magnet bends each on a half circle whose
 * radius grows as the square root of its mass, and each isotope lands on the
 * detector at its own place. The peak there stands as tall as the isotope's
 * share of the sample, and the footer weighs the isotopes into the average
 * atomic mass the periodic table lists.
 *
 * @param samples - The elements to offer, in order
 */
export function MassSpectrometerLab({
  description,
  labels,
  samples,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: SpectrometerLabels;
  readonly samples: readonly SampleId[];
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const offered = Arr.filter(samples, (id) => Schema.is(SampleIdSchema)(id));
  const [chosen, setChosen] = useState<SampleId | undefined>(undefined);
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const sample = getSample(shown);
  const number = (value: number, digits: number) =>
    format
      .number(value, { maximumFractionDigits: digits, useGrouping: false })
      .replaceAll(",", "{,}");
  const nuclide = (mass: number) => `\\mathrm{^{${mass}}${sample.symbol}}`;
  const isotopes = sample.isotopes;
  const first = Option.getOrUndefined(Arr.head(isotopes));
  const last = Option.getOrUndefined(Arr.last(isotopes));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {offered.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.choose}
            gridColumns={toggleColumns(offered.length)}
            onValueChange={(value: string) => {
              if (Schema.is(SampleIdSchema)(value)) {
                setChosen(value);
              }
            }}
            type="single"
            value={shown}
            variant="outline"
          >
            {Arr.map(offered, (id) => (
              <ToggleGroupItem
                aria-label={getSample(id).symbol}
                key={id}
                value={id}
              >
                <InlineMath math={`\\mathrm{${getSample(id).symbol}}`} />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </VisualCardToolbar>
      ) : null}

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={-0.02} reach={8} setting="lab">
          <Suspense>
            <SpectrometerCamera />
            <Spectrometer key={shown} sampleId={shown} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.isotopes}
            value={
              <InlineMath
                math={Arr.join(
                  Arr.map(
                    isotopes,
                    (isotope) =>
                      `${nuclide(isotope.number)}: ${number(isotope.abundance * 100, 2)}\\%`
                  ),
                  ",\\ "
                )}
              />
            }
          />
          <VisualFact
            label={labels.average}
            value={
              <InlineMath
                math={`\\bar{A} = ${Arr.join(
                  Arr.map(
                    isotopes,
                    (isotope) =>
                      `${number(isotope.abundance, 4)}(${number(isotope.mass, 2)})`
                  ),
                  " + "
                )} = ${number(averageMass(shown), 2)}`}
              />
            }
          />
          <VisualFact
            label={labels.radius}
            value={<InlineMath math="r \propto \sqrt{m}" />}
          />
          <VisualFact
            label={labels.ratio}
            value={
              first && last ? (
                <InlineMath
                  math={`\\dfrac{r_{${last.number}}}{r_{${first.number}}} = \\sqrt{\\dfrac{${number(last.mass, 2)}}{${number(first.mass, 2)}}} = ${number(pathRadius(last.mass, first.mass), 3)}`}
                />
              ) : null
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The instrument: the ion source and its slit, the magnet's poles as two
 * half discs, one glowing beam per isotope on its half circle, the detector
 * plate, and a peak at each landing place. While the card plays, ions fly
 * round the beams, more of them on the more common isotope.
 */
function Spectrometer({ sampleId }: { readonly sampleId: SampleId }) {
  const sample = getSample(sampleId);
  const playing = useVisualScene((card) => card.playing, false);
  const beams = useMemo(
    () =>
      Arr.map(sample.isotopes, (isotope, index) => {
        const radius = BASE_RADIUS * pathRadius(isotope.mass, BASE_MASS);
        const color = new Color(BEAMS[index % BEAMS.length]).multiplyScalar(
          1.8
        );
        return {
          color,
          ions: Arr.map(
            Arr.range(1, Math.max(1, Math.round(isotope.abundance * 6))),
            (ion) => ({ offset: ion / 6, ref: createRef<Mesh>() })
          ),
          isotope,
          points: Arr.map(Arr.range(0, 96), (step) => {
            const angle = Math.PI - (Math.PI * step) / 96;
            return [
              radius + radius * Math.cos(angle),
              0.3,
              -radius * Math.sin(angle),
            ] as const;
          }),
          radius,
        };
      }),
    [sample]
  );
  const widest = Arr.reduce(beams, 0, (most, beam) =>
    Math.max(most, beam.radius)
  );

  useFrame((state) => {
    const time = playing ? state.clock.elapsedTime / FLIGHT : 0.5;
    for (const beam of beams) {
      for (const ion of beam.ions) {
        const share = (time + ion.offset) % 1;
        const angle = Math.PI - Math.PI * share;
        ion.ref.current?.position.set(
          beam.radius + beam.radius * Math.cos(angle),
          0.3,
          -beam.radius * Math.sin(angle)
        );
      }
    }
  });

  return (
    <group position={[-widest, 0, widest / 2]}>
      <mesh castShadow position={[-0.1, 0.3, 1.2]}>
        <boxGeometry args={[0.9, 0.7, 1.6]} />
        <MetalMaterial color={getColor("SLATE", 600)} />
      </mesh>
      <Line
        color={getColor("SLATE", 400)}
        lineWidth={2}
        points={[
          [0, 0.3, 0.4],
          [0, 0.3, 0],
        ]}
        toneMapped={false}
      />
      <mesh
        position={[widest, 0.02, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[widest + 0.9, 64, 0, Math.PI]} />
        <MetalMaterial color={getColor("NEUTRAL", 800)} roughness={0.5} />
      </mesh>
      <mesh position={[widest, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[widest + 0.9, 64, 0, Math.PI]} />
        <GlassMaterial color={getColor("SLATE", 300)} opacity={0.12} />
      </mesh>
      <mesh position={[widest, 0.15, 0.25]} receiveShadow>
        <boxGeometry args={[2 * widest + 1.4, 0.3, 0.3]} />
        <MetalMaterial color={getColor("SLATE", 400)} />
      </mesh>
      {Arr.map(beams, (beam) => (
        <group key={beam.isotope.number}>
          <Line
            color={beam.color}
            lineWidth={2.2}
            points={beam.points}
            toneMapped={false}
          />
          {Arr.map(beam.ions, (ion) => (
            <mesh key={ion.offset} ref={ion.ref}>
              <sphereGeometry args={[0.07, 12, 8]} />
              <meshBasicMaterial color={beam.color} toneMapped={false} />
            </mesh>
          ))}
          <mesh
            castShadow
            position={[
              2 * beam.radius,
              0.3 + (PEAK * beam.isotope.abundance) / 2,
              0.25,
            ]}
          >
            <boxGeometry args={[0.12, PEAK * beam.isotope.abundance, 0.12]} />
            <meshStandardMaterial
              color={beam.color}
              emissive={beam.color}
              emissiveIntensity={0.4}
              side={DoubleSide}
            />
          </mesh>
          <ThreeLabel
            color={getColor("SLATE", 400)}
            fontSize="compact"
            position={[
              2 * beam.radius,
              0.45 + PEAK * beam.isotope.abundance,
              0.25,
            ]}
          >
            <InlineMath
              math={`\\mathrm{^{${beam.isotope.number}}${sample.symbol}}`}
            />
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}

/** Looks down on the magnet from in front and above, the detector in front. */
function SpectrometerCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 30 : 22;
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.8, distance * 0.6]}
      cameraTarget={[0, 0.5, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={3}
    />
  );
}
