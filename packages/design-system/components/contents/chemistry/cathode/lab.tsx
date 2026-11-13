import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  ANODE_VOLTAGE,
  beamHeight,
  beamPath,
  PLATE_LIMIT,
  spotHeight,
  TUBE,
} from "@repo/design-system/components/contents/chemistry/cathode/beam";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
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
import { Color, DoubleSide, type Mesh } from "three";
import { useFormatter } from "use-intl";

/** Where the cathode stands behind the anode, in centimetres. */
const CATHODE_X = -3.5;

/** How many electrons fly along the beam at once while the card plays. */
const ELECTRONS = 14;

/** How fast the drawn electrons move, in centimetres a second; real ones are a billion times faster. */
const DRIFT = 4;

/** The height of the bench under the tube's stand, in centimetres. */
const FLOOR = -3;

/** The words a cathode-ray lab reads from its lesson. */
interface CathodeLabels {
  /** The readout of the voltage that speeds the electrons up. */
  readonly anode: ReactNode;
  /** The readout of the electric field between the plates. */
  readonly field: ReactNode;
  /** The name of the plate-voltage slider and its readout. */
  readonly plates: string;
  /** The readout of how far the glowing spot moved on the screen. */
  readonly spot: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * Thomson's cathode-ray tube at real size: electrons leave the hot cathode,
 * pass the anode, cross two charged plates, and light a spot on the
 * phosphor screen. Charge the plates and the beam bends toward the positive
 * one, which is how Thomson knew the rays are negative particles. The path is
 * the exact parabola between the plates and a straight line after them.
 */
export function CathodeRayLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: CathodeLabels;
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const [plate, setPlate] = useState(100);
  const number = (value: number, digits: number) =>
    mathNumber(
      format.number(value, {
        ...MATH_NUMBER_OPTIONS,
        maximumFractionDigits: digits,
      })
    );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.plates}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`${number(plate, 0)}\\ \\mathrm{V}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.plates}
            max={PLATE_LIMIT}
            min={-PLATE_LIMIT}
            onValueChange={(value: number) => setPlate(value)}
            step={10}
            value={plate}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={FLOOR} reach={9} setting="lab">
          <Suspense>
            <CathodeCamera />
            <CathodeTube plate={plate} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.anode}
            value={
              <InlineMath
                math={`V_a = ${number(ANODE_VOLTAGE, 0)}\\ \\mathrm{V}`}
              />
            }
          />
          <VisualFact
            label={labels.plates}
            value={
              <InlineMath math={`V_p = ${number(plate, 0)}\\ \\mathrm{V}`} />
            }
          />
          <VisualFact
            label={labels.field}
            value={
              <InlineMath
                math={`E = \\dfrac{V_p}{d} = ${number(Math.abs(plate) / (TUBE.gap / 100), 0)}\\ \\mathrm{V/m}`}
              />
            }
          />
          <VisualFact
            label={labels.spot}
            value={
              <InlineMath
                math={`y = ${number(spotHeight(plate), 2)}\\ \\mathrm{cm}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The tube, its electrodes, the plates with their signs, the glowing beam and
 * spot, and the electrons that drift along the beam while the card plays.
 */
function CathodeTube({ plate }: { readonly plate: number }) {
  const playing = useVisualScene((card) => card.playing, false);
  const glow = new Color(PLOT_COLORS.teal).multiplyScalar(2.4);
  const end = TUBE.plates + TUBE.screen;
  const path = useMemo(
    () =>
      Arr.prepend(
        Arr.map(beamPath(plate, 120), ([x, y]) => [x, y, 0] as const),
        [CATHODE_X, 0, 0] as const
      ),
    [plate]
  );
  const electrons = useMemo(
    () =>
      Arr.map(Arr.range(1, ELECTRONS), (index) => ({
        offset: ((end - CATHODE_X) * index) / ELECTRONS,
        ref: createRef<Mesh>(),
      })),
    [end]
  );
  const top = plate >= 0 ? "+" : "-";
  const bottom = plate >= 0 ? "-" : "+";

  useFrame((state) => {
    const seconds = playing ? state.clock.elapsedTime : 0;
    for (const electron of electrons) {
      const x =
        CATHODE_X + ((electron.offset + seconds * DRIFT) % (end - CATHODE_X));
      electron.ref.current?.position.set(x, beamHeight(x, plate), 0);
    }
  });

  return (
    <group>
      <mesh
        position={[(CATHODE_X - 1 + 6) / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.95, 0.95, 6 - CATHODE_X + 1, 48, 1, true]} />
        <GlassMaterial color={getColor("SLATE", 200)} />
      </mesh>
      <mesh position={[9, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[2.7, 0.95, 6, 48, 1, true]} />
        <GlassMaterial color={getColor("SLATE", 200)} />
      </mesh>
      <mesh position={[end + 0.02, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[2.68, 64]} />
        <meshStandardMaterial
          color={getColor("SLATE", 300)}
          roughness={0.85}
          side={DoubleSide}
        />
      </mesh>
      <mesh
        position={[end - 0.01, spotHeight(plate), 0]}
        scale={[0.04, 0.22, 0.22]}
      >
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color={glow} toneMapped={false} />
      </mesh>
      <mesh position={[CATHODE_X, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 0.12, 32]} />
        <MetalMaterial color={getColor("STONE", 600)} />
      </mesh>
      <mesh position={[-0.6, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.12, 0.85, 40]} />
        <meshPhysicalMaterial
          color={getColor("SLATE", 400)}
          metalness={1}
          roughness={0.3}
          side={DoubleSide}
        />
      </mesh>
      {Arr.map(
        [
          { sign: top, y: TUBE.gap / 2 },
          { sign: bottom, y: -TUBE.gap / 2 },
        ] as const,
        (each) => (
          <group key={each.y}>
            <mesh
              castShadow
              position={[TUBE.plates / 2, each.y + Math.sign(each.y) * 0.03, 0]}
            >
              <boxGeometry args={[TUBE.plates, 0.06, 1.3]} />
              <MetalMaterial color={getColor("SLATE", 400)} roughness={0.25} />
            </mesh>
            <ThreeLabel
              color={getColor("SLATE", 800)}
              fontSize="compact"
              position={[
                TUBE.plates / 2,
                each.y + Math.sign(each.y) * 0.45,
                0.7,
              ]}
            >
              <InlineMath math={each.sign} />
            </ThreeLabel>
          </group>
        )
      )}
      <Line color={glow} lineWidth={2.2} points={path} toneMapped={false} />
      {Arr.map(electrons, (electron) => (
        <mesh key={electron.offset} ref={electron.ref}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshBasicMaterial color={glow} toneMapped={false} />
        </mesh>
      ))}
      <CathodeStand />
    </group>
  );
}

/** Two steel posts on a dark base that hold the tube above the bench. */
function CathodeStand() {
  return (
    <group>
      {Arr.map([0.5, 9] as const, (x) => (
        <mesh castShadow key={x} position={[x, (FLOOR - 1.1) / 2, -0.2]}>
          <cylinderGeometry args={[0.08, 0.08, -FLOOR - 1.1 + 0.1, 16]} />
          <MetalMaterial color={getColor("SLATE", 400)} />
        </mesh>
      ))}
      <mesh castShadow position={[4.75, FLOOR + 0.12, -0.2]} receiveShadow>
        <boxGeometry args={[11, 0.24, 2.4]} />
        <meshStandardMaterial
          color={getColor("NEUTRAL", 800)}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}

/** Looks along the tube from the front and a little above, wider on a narrow card. */
function CathodeCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 26 : 19;
  return (
    <CameraControls
      cameraPosition={[4.5 - distance * 0.25, distance * 0.28, distance]}
      cameraTarget={[4.5, -0.4, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={4}
    />
  );
}
