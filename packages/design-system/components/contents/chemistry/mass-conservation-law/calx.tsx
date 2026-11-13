import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  airAfterDays,
  calxAfterDays,
  LAVOISIER,
  mercuryRiseAfterDays,
} from "@repo/design-system/components/contents/chemistry/mass-conservation-law/masses";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CatmullRomCurve3,
  type InstancedMesh,
  type Mesh,
  type MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from "three";

/** The bell jar's inner radius, in metres. */
const JAR_RADIUS = 0.06;

/** Played, the twelve days pass in twelve seconds. */
const DAYS_PER_SECOND = 1;

/** How many red specks of calx the mercury can carry. */
const SPECKS = 160;

/** The matrass's bulb sits on the furnace; its neck ends under the bell jar. */
const BULB = new Vector3(-0.2, 0.2, 0);
const JAR = new Vector3(0.16, 0, 0);

/**
 * Lavoisier's experiment of 1776 as he describes it in "Elements of
 * Chemistry": mercury heated for twelve days in a glass matrass whose long
 * neck opens into air under a bell jar standing in a trough of mercury. Day
 * by day red calx forms on the hot mercury and the air under the jar shrinks,
 * so the mercury climbs inside the jar. The learner scrubs or plays the days;
 * the readouts follow his numbers from 50 to 42.5 cubic inches and from 0 to
 * 45 grains.
 */
export function LavoisierCalxLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly air: ReactNode;
    readonly airUnit: string;
    readonly calx: ReactNode;
    readonly calxUnit: string;
    readonly day: string;
    readonly reverse: ReactNode;
    readonly reverseLabel: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [day, setDay] = useState<number>(LAVOISIER.days);
  const quantity = useQuantity();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.day}</span>
            <span className="tabular-nums">
              {Math.floor(day)}/{LAVOISIER.days}
            </span>
          </div>
          <Slider
            aria-label={labels.day}
            max={LAVOISIER.days}
            min={0}
            onValueChange={setDay}
            step={0.5}
            value={day}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.7} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.1, 0.42, 0.95]}
              cameraTarget={[0, 0.14, 0]}
              fov={32}
              maxDistance={2}
              minDistance={0.4}
            />
            <CalxScene day={day} onDay={setDay} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.air}
            value={
              <InlineMath
                math={quantity(airAfterDays(day), `\\text{ ${labels.airUnit}}`)}
              />
            }
          />
          <VisualFactTabular
            label={labels.calx}
            value={
              <InlineMath
                math={quantity(
                  calxAfterDays(day),
                  `\\text{ ${labels.calxUnit}}`
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.reverseLabel}
            value={labels.reverse}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The matrass's neck: up from the bulb, over, and down into the bell jar. */
function createNeck() {
  return new TubeGeometry(
    new CatmullRomCurve3([
      new Vector3(BULB.x, BULB.y + 0.04, 0),
      new Vector3(BULB.x + 0.02, BULB.y + 0.12, 0),
      new Vector3(-0.02, BULB.y + 0.13, 0),
      new Vector3(JAR.x - 0.02, 0.24, 0),
      new Vector3(JAR.x, 0.16, 0),
      new Vector3(JAR.x, 0.07, 0),
    ]),
    96,
    0.006,
    12
  );
}

/**
 * The furnace, the matrass of mercury, the trough and the bell jar. Played,
 * the scene advances the day itself and hands it to the card, so the slider
 * and the readouts move with it.
 */
function CalxScene({
  day,
  onDay,
}: {
  readonly day: number;
  readonly onDay: (day: number) => void;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const inside = useRef<Mesh>(null);
  const specks = useRef<InstancedMesh>(null);
  const coals = useRef<MeshStandardMaterial>(null);
  const clock = useRef(day);
  const sent = useRef(day);
  const neck = useMemo(createNeck, []);
  useEffect(() => () => neck.dispose(), [neck]);

  // A day the learner set on the slider moves the clock; a day the scene
  // sent while playing is already on it.
  useEffect(() => {
    if (day !== sent.current) {
      clock.current = day;
      sent.current = day;
    }
  }, [day]);

  useFrame(({ clock: frame }, delta) => {
    if (playing) {
      const next =
        clock.current >= LAVOISIER.days
          ? 0
          : Math.min(LAVOISIER.days, clock.current + delta * DAYS_PER_SECOND);
      clock.current = next;
      const rounded = Math.round(next * 2) / 2;
      if (rounded !== sent.current) {
        sent.current = rounded;
        onDay(rounded);
      }
    }
    const shown = clock.current;
    const rise = mercuryRiseAfterDays(shown, JAR_RADIUS);
    inside.current?.position.setY(0.022 + rise);
    const share = calxAfterDays(shown) / LAVOISIER.calx;
    Arr.forEach(specks.current?.children ?? [], (speck, index) => {
      speck.scale.setScalar(hashUnit(index, 1) < share ? 1 : 0);
    });
    if (coals.current) {
      coals.current.emissiveIntensity =
        2.2 +
        0.4 * Math.sin(frame.elapsedTime * 3 + Math.sin(frame.elapsedTime * 7));
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <LabBench width={2.6} />
      <group position={[BULB.x, 0, 0]}>
        <mesh castShadow position={[0, 0.07, 0]} receiveShadow>
          <boxGeometry args={[0.18, 0.14, 0.16]} />
          <meshStandardMaterial color={MATERIAL.brick} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.06, 0.081]}>
          <planeGeometry args={[0.08, 0.05]} />
          <meshStandardMaterial
            color={MATERIAL.coals}
            emissive={MATERIAL.coalGlow}
            emissiveIntensity={2.2}
            ref={coals}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh castShadow position={BULB}>
        <sphereGeometry args={[0.05, 40, 24]} />
        <GlassMaterial color={MATERIAL.glass} opacity={0.22} />
      </mesh>
      <mesh position={[BULB.x, BULB.y - 0.03, 0]}>
        <sphereGeometry
          args={[0.036, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
        />
        <MetalMaterial color={MATERIAL.mercury} roughness={0.08} />
      </mesh>
      <Instances limit={SPECKS} ref={specks}>
        <boxGeometry args={[0.004, 0.0015, 0.004]} />
        <meshStandardMaterial color={MATERIAL.calx} roughness={0.8} />
        {Arr.map(Arr.range(1, SPECKS), (index) => {
          const angle = hashUnit(index, 2) * Math.PI * 2;
          const radius = 0.033 * Math.sqrt(hashUnit(index, 3));
          return (
            <Instance
              key={index}
              position={[
                BULB.x + Math.cos(angle) * radius,
                BULB.y - 0.029,
                Math.sin(angle) * radius,
              ]}
              rotation={[0, angle, 0]}
            />
          );
        })}
      </Instances>
      <mesh geometry={neck}>
        <GlassMaterial color={MATERIAL.glass} opacity={0.3} />
      </mesh>
      <group position={JAR}>
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <cylinderGeometry args={[0.11, 0.1, 0.03, 48, 1, true]} />
          <meshStandardMaterial color={MATERIAL.trough} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.022, 0]}>
          <cylinderGeometry args={[0.105, 0.105, 0.002, 48]} />
          <MetalMaterial color={MATERIAL.mercury} roughness={0.06} />
        </mesh>
        <mesh position={[0, 0.022, 0]} ref={inside}>
          <cylinderGeometry
            args={[JAR_RADIUS - 0.002, JAR_RADIUS - 0.002, 0.002, 40]}
          />
          <MetalMaterial color={MATERIAL.mercury} roughness={0.05} />
        </mesh>
        <mesh castShadow position={[0, 0.1, 0]}>
          <cylinderGeometry
            args={[JAR_RADIUS, JAR_RADIUS, 0.16, 48, 1, true]}
          />
          <GlassMaterial color={MATERIAL.glass} opacity={0.2} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <sphereGeometry
            args={[JAR_RADIUS, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <GlassMaterial color={MATERIAL.glass} opacity={0.2} />
        </mesh>
      </group>
    </>
  );
}
