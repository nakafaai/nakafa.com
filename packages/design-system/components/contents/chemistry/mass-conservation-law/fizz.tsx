import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  Flask,
  FlaskLiquid,
  flaskRadiusAt,
  LabBench,
  Scale,
  type ScaleRig,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  carbonDioxideFrom,
  FIZZ_TIME,
  fizzProgress,
} from "@repo/design-system/components/contents/chemistry/mass-conservation-law/masses";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import {
  useQuantity,
  useReading,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Schema } from "effect";
import { type ReactNode, Suspense, useRef, useState } from "react";
import type { Group, InstancedMesh, Mesh, Object3D } from "three";

/** Whether the flask stays open to the air or is closed with a stopper. */
const SealSchema = Schema.Literals(["open", "closed"]);
type Seal = typeof SealSchema.Type;

/** The lab's amounts: 100.00 g of vinegar and 2.00 g of baking soda. */
const VINEGAR = 100;
const SODA = 2;

/** The vinegar fills the flask to 50 mm. */
const LEVEL = 0.05;

/** How many bubbles and wisps the scene can show at once. */
const BUBBLES = 48;
const WISPS = 24;

/** The run: two seconds before the soda drops in, and five reaction times after. */
const START = -2;
const END = 5 * FIZZ_TIME;

/**
 * Baking soda drops into vinegar in a flask that stands on a balance with
 * everything else: the soda's dish, the vinegar and the flask. The mixture
 * fizzes as carbon dioxide forms. Open, the gas leaves through the neck and
 * the reading falls by the gas's mass; closed, the gas stays in the flask and
 * the reading never moves.
 */
export function FizzBalanceLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly chooseSeal: string;
    readonly gasEscaped: ReactNode;
    readonly gasFormed: ReactNode;
    readonly readingAfter: ReactNode;
    readonly readingBefore: ReactNode;
    readonly seals: Readonly<Record<Seal, string>>;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [seal, setSeal] = useState<Seal>("open");
  const quantity = useQuantity();
  const gas = carbonDioxideFrom(SODA);
  const before = VINEGAR + SODA;
  const after = seal === "open" ? before - gas : before;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSeal}
          onValueChange={(value: string) => {
            if (Schema.is(SealSchema)(value)) {
              setSeal(value);
            }
          }}
          type="single"
          value={seal}
          variant="outline"
        >
          {Arr.map(SealSchema.literals, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.seals[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} reach={0.6} setting="lab">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[0.32, 0.36, 0.62]}
              cameraTarget={[0, 0.12, 0]}
              fov={34}
              maxDistance={1.6}
              minDistance={0.35}
            />
            <FizzScene seal={seal} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.readingBefore}
            value={<InlineMath math={quantity(before, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.readingAfter}
            value={<InlineMath math={quantity(after, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.gasFormed}
            value={<InlineMath math={quantity(gas, "\\text{ g}", 2)} />}
          />
          <VisualFactTabular
            label={labels.gasEscaped}
            value={
              <InlineMath
                math={quantity(seal === "open" ? gas : 0, "\\text{ g}", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The bench, the balance, the flask of vinegar and the dish of soda, run by
 * the card's play clock.
 */
function FizzScene({ seal }: { readonly seal: Seal }) {
  const scale = useRef<ScaleRig>(null);
  const dish = useRef<Group>(null);
  const powder = useRef<Mesh>(null);
  const foam = useRef<Mesh>(null);
  const bubbles = useRef<InstancedMesh>(null);
  const wisps = useRef<InstancedMesh>(null);
  const reading = useReading();
  const gas = carbonDioxideFrom(SODA);
  const { advance, playing } = useTimeline(START, END);

  useFrame(({ clock }, delta) => {
    const time = advance(delta);
    const progress = fizzProgress(time);
    const rate = time <= 0 ? 0 : Math.exp(-time / FIZZ_TIME);
    const escaped = seal === "open" ? gas * progress : 0;
    scale.current?.show(reading(VINEGAR + SODA - escaped, 2));
    const tip = Math.min(1, Math.max(0, (time + 1) / 1));
    dish.current?.rotation.set(0, 0, tip * 1.9);
    if (powder.current) {
      powder.current.visible = time < 0.2;
    }
    if (foam.current) {
      foam.current.scale.set(1, 0.2 + 3 * rate, 1);
      foam.current.visible = rate > 0.02;
    }
    moveParticles(bubbles.current, clock.elapsedTime, rate, (unit, index) => [
      (hashUnit(index, 1) - 0.5) * 0.05,
      0.004 + unit * (LEVEL - 0.004),
      (hashUnit(index, 2) - 0.5) * 0.05,
    ]);
    moveParticles(
      seal === "open" ? wisps.current : null,
      clock.elapsedTime * 0.5,
      rate,
      (unit, index) => [
        (hashUnit(index, 3) - 0.5) * 0.03 * (1 + unit * 3),
        0.15 + unit * 0.22,
        (hashUnit(index, 4) - 0.5) * 0.03 * (1 + unit * 3),
      ]
    );
    if (wisps.current) {
      wisps.current.visible = seal === "open";
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <LabBench />
      <Scale ref={scale} unitLabel="g">
        <Flask />
        <FlaskLiquid color={MATERIAL.vinegar} level={LEVEL} />
        <mesh position={[0, LEVEL + 0.002, 0]} ref={foam}>
          <cylinderGeometry
            args={[
              flaskRadiusAt(LEVEL) - 0.003,
              flaskRadiusAt(LEVEL) - 0.002,
              0.004,
              32,
            ]}
          />
          <meshStandardMaterial color={MATERIAL.foam} roughness={0.9} />
        </mesh>
        <Instances limit={BUBBLES} ref={bubbles}>
          <sphereGeometry args={[0.0022, 8, 6]} />
          <meshPhysicalMaterial
            clearcoat={1}
            color={getColor("WHITE")}
            opacity={0.7}
            roughness={0.05}
            transparent
          />
          {Arr.map(Arr.range(1, BUBBLES), (index) => (
            <Instance key={index} />
          ))}
        </Instances>
        <Instances limit={WISPS} ref={wisps}>
          <sphereGeometry args={[0.012, 10, 8]} />
          <meshBasicMaterial
            color={MATERIAL.gasWisp}
            depthWrite={false}
            opacity={0.12}
            transparent
          />
          {Arr.map(Arr.range(1, WISPS), (index) => (
            <Instance key={index} />
          ))}
        </Instances>
        {seal === "closed" ? (
          <mesh castShadow position={[0, 0.152, 0]}>
            <cylinderGeometry args={[0.019, 0.015, 0.024, 24]} />
            <meshStandardMaterial color={MATERIAL.stopper} roughness={0.85} />
          </mesh>
        ) : null}
        <group position={[0.075, 0.004, 0]} ref={dish}>
          <mesh receiveShadow>
            <cylinderGeometry args={[0.028, 0.022, 0.008, 28]} />
            <meshStandardMaterial color={MATERIAL.dish} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.006, 0]} ref={powder}>
            <sphereGeometry
              args={[0.016, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color={MATERIAL.bakingSoda} roughness={1} />
          </mesh>
        </group>
      </Scale>
    </>
  );
}

/**
 * Moves a group of particle instances: each one rises from 0 to 1 along its
 * own path on its own phase, and only a share of them as large as `rate`
 * shows, so the fizz dies down as the soda runs out.
 */
function moveParticles(
  group: Object3D | null,
  elapsed: number,
  rate: number,
  place: (unit: number, index: number) => readonly [number, number, number]
) {
  if (!group) {
    return;
  }
  Arr.forEach(group.children, (child, index) => {
    const unit =
      (elapsed * (0.6 + hashUnit(index, 9)) + hashUnit(index, 5)) % 1;
    const [x, y, z] = place(unit, index);
    child.position.set(x, y, z);
    child.scale.setScalar(hashUnit(index, 6) < rate ? 1 : 0);
  });
}
