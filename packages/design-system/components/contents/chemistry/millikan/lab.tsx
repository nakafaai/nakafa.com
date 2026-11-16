import { useFrame, useThree } from "@react-three/fiber";
import {
  APPARATUS,
  chargeToHover,
  DROPS,
  dropVelocity,
  ELEMENTARY_CHARGE,
  nearestDrop,
} from "@repo/design-system/components/contents/chemistry/millikan/drop";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
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

/** How many scene units one millimetre of the gap spans. */
const MILLIMETRE = 1;

/** How much faster than life the drops move, so a 0.1 mm/s drift reads at once. */
const SPEEDUP = 12;

/** The highest plate voltage the slider reaches, in volts. */
const MOST_VOLTAGE = 1500;

/** The words a Millikan lab reads from its lesson. */
interface MillikanLabels {
  /** The readout of the charge a drop needs to hover. */
  readonly charge: ReactNode;
  /** The readout of the field between the plates. */
  readonly field: ReactNode;
  /** The readout of that charge in elementary charges. */
  readonly multiple: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
  /** The name of the voltage slider and its readout. */
  readonly voltage: string;
}

/**
 * Millikan's oil drops between two charged plates: four drops of the same
 * size carry one, two, three and five electrons' worth of charge. Raise the
 * voltage until one drop hangs still; there the electric force equals its
 * weight, and the charge it must carry comes out as a whole number of
 * elementary charges.
 */
export function MillikanOilDropLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: MillikanLabels;
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const [voltage, setVoltage] = useState(500);
  const charge = chargeToHover(voltage);
  const [mantissa, exponent] = format
    .number(charge, { maximumFractionDigits: 2, notation: "scientific" })
    .split("E");
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
            <span>{labels.voltage}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`${decimal(voltage, 0)}\\ \\mathrm{V}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.voltage}
            max={MOST_VOLTAGE}
            min={50}
            onValueChange={(value: number) => setVoltage(value)}
            step={1}
            value={voltage}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={6} setting="lab">
          <Suspense>
            <MillikanCamera />
            <Plates voltage={voltage} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.voltage}
            value={
              <InlineMath math={`V = ${decimal(voltage, 0)}\\ \\mathrm{V}`} />
            }
          />
          <VisualFact
            label={labels.field}
            value={
              <InlineMath
                math={`E = \\dfrac{V}{d} = ${decimal(voltage / APPARATUS.gap, 0)}\\ \\mathrm{V/m}`}
              />
            }
          />
          <VisualFact
            label={labels.charge}
            value={
              <InlineMath
                math={`q = \\dfrac{mgd}{V} = ${(mantissa ?? "").replaceAll(",", "{,}")} \\times 10^{${exponent ?? ""}}\\ \\mathrm{C}`}
              />
            }
          />
          <VisualFact
            label={labels.multiple}
            value={
              <InlineMath
                math={`\\dfrac{q}{e} = ${decimal(charge / ELEMENTARY_CHARGE, 2)}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The two round brass plates 5 mm apart and the drops between them, each
 * glinting in the lamp light and drifting at its Stokes speed: up when the
 * field outweighs gravity, down when it does not, and still at balance.
 * Drops that reach a plate start again in the middle.
 */
function Plates({ voltage }: { readonly voltage: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const gap = APPARATUS.gap * 1000 * MILLIMETRE;
  const drops = useMemo(
    () =>
      Arr.map(DROPS, (charges, index) => ({
        charges,
        height: { value: 0 },
        ref: createRef<Mesh>(),
        x: (index - (DROPS.length - 1) / 2) * 1.3,
      })),
    []
  );
  const balanced = nearestDrop(voltage);
  const glint = new Color(PLOT_COLORS.amber).multiplyScalar(1.6);

  useFrame((_, seconds) => {
    for (const drop of drops) {
      if (playing) {
        const speed =
          dropVelocity(drop.charges, voltage) * 1000 * MILLIMETRE * SPEEDUP;
        const next = drop.height.value + speed * Math.min(seconds, 0.1);
        drop.height.value = Math.abs(next) > gap / 2 - 0.25 ? 0 : next;
      }
      drop.ref.current?.position.set(drop.x, drop.height.value, 0);
    }
  });

  return (
    <group>
      {Arr.map([gap / 2 + 0.06, -gap / 2 - 0.06] as const, (y) => (
        <mesh castShadow key={y} position={[0, y, 0]} receiveShadow>
          <cylinderGeometry args={[3.4, 3.4, 0.12, 64]} />
          <MetalMaterial color={PLOT_COLORS.amber} roughness={0.28} />
        </mesh>
      ))}
      <ThreeLabel
        color={getColor("SLATE", 400)}
        fontSize="compact"
        position={[3.7, gap / 2 + 0.06, 0]}
      >
        <InlineMath math="+" />
      </ThreeLabel>
      <ThreeLabel
        color={getColor("SLATE", 400)}
        fontSize="compact"
        position={[3.7, -gap / 2 - 0.06, 0]}
      >
        <InlineMath math="-" />
      </ThreeLabel>
      {Arr.map(drops, (drop) => (
        <mesh key={drop.charges} ref={drop.ref}>
          <sphereGeometry
            args={[drop.charges === balanced ? 0.12 : 0.1, 24, 16]}
          />
          <meshStandardMaterial
            color={glint}
            emissive={glint}
            emissiveIntensity={drop.charges === balanced ? 2.2 : 1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Looks between the plates from the front, as through Millikan's telescope. */
function MillikanCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 13 : 10;
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.18, distance]}
      cameraTarget={[0, 0, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={3}
    />
  );
}
