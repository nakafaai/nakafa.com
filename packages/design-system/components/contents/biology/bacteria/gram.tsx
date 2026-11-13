import { useFrame } from "@react-three/fiber";
import { MicroscopeField } from "@repo/design-system/components/contents/biology/bacteria/field";
import {
  type Gram,
  type Hue,
  hueOf,
  type StainStep,
  StainStepSchema,
  stainOf,
} from "@repo/design-system/components/contents/biology/bacteria/microbe";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Array as Arr, Schema } from "effect";
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
  Color,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from "three";

/** The new stain soaks in over this many seconds. */
const SOAK = 0.8;

/** Grape-like clusters of cocci: Staphylococcus, Gram-positive. */
const CLUSTERS = 7;
const COCCI_PER_CLUSTER = 8;
const COCCUS = 0.5;

/** Short rods: Escherichia coli, Gram-negative, 2 µm long and 0.8 µm wide. */
const RODS = 16;
const ROD = { length: 2, radius: 0.4 } as const;

/** Spirals: Spirillum, Gram-negative, about 10 µm long. */
const SPIRALS = 5;

/** Where the cells lie on the slide: spread inside the field's light. */
function scatter(index: number, salt: number) {
  const angle = hashUnit(index, salt) * Math.PI * 2;
  const radius = 46 * Math.sqrt(hashUnit(salt, index + 17));
  return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
}

/**
 * A Gram stain under the microscope, step by step, on a slide that carries
 * three shapes of bacteria at 1000×: clusters of round cocci, short rods and
 * long spirals. Before staining they are hard to see; crystal violet and
 * iodine turn every cell purple; alcohol washes the purple out of the thin
 * walls of the Gram-negative rods and spirals; safranin turns those pink.
 */
export function GramStainLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly chooseStep: string;
    readonly hues: Readonly<Record<Hue, ReactNode>>;
    readonly negative: ReactNode;
    readonly positive: ReactNode;
    readonly steps: Readonly<Record<StainStep, string>>;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [step, setStep] = useState<StainStep>("safranin");

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseStep}
          onValueChange={(value: string) => {
            if (Schema.is(StainStepSchema)(value)) {
              setStep(value);
            }
          }}
          type="single"
          value={step}
          variant="outline"
        >
          {Arr.map(StainStepSchema.literals, (each) => (
            <ToggleGroupItem key={each} value={each}>
              {labels.steps[each]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={60} setting="studio">
          <Suspense fallback={null}>
            <GramScene step={step} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.positive}
            value={labels.hues[hueOf("positive", step)]}
          />
          <VisualFact
            label={labels.negative}
            value={labels.hues[hueOf("negative", step)]}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** One wavy spiral cell along the slide, as a tube. */
function createSpiral(index: number) {
  const [x, z] = scatter(index, 3);
  const heading = hashUnit(index, 4) * Math.PI;
  const points = Arr.map(Arr.range(0, 40), (step) => {
    const along = (step / 40 - 0.5) * 10;
    const wave = Math.sin((step / 40) * Math.PI * 6) * 0.9;
    return new Vector3(
      x + Math.cos(heading) * along - Math.sin(heading) * wave,
      0,
      z + Math.sin(heading) * along + Math.cos(heading) * wave
    );
  });
  return new TubeGeometry(new CatmullRomCurve3(points), 80, 0.3, 8);
}

/** A material for one kind of wall, whose colour the stain sets. */
function createStainMaterial() {
  return new MeshStandardMaterial({ roughness: 0.6, transparent: true });
}

/**
 * The slide. Changing the step soaks the new colour into the cells over a
 * moment, as a stain soaks in, so the change reads as staining and not a
 * switch.
 */
function GramScene({ step }: { readonly step: StainStep }) {
  const materials = useMemo(
    () => ({
      negative: createStainMaterial(),
      positive: createStainMaterial(),
    }),
    []
  );
  const spirals = useMemo(
    () => Arr.map(Arr.range(1, SPIRALS), createSpiral),
    []
  );
  const soaked = useRef(1);
  const soaking = useRef<StainStep>(step);
  const [settled, setSettled] = useState(step);
  const from = useRef({ negative: new Color(), positive: new Color() });

  useEffect(
    () => () => {
      materials.negative.dispose();
      materials.positive.dispose();
      Arr.forEach(spirals, (spiral) => spiral.dispose());
    },
    [materials, spirals]
  );

  useFrame((_, delta) => {
    // A new step starts soaking in from the colours the cells show now.
    if (soaking.current !== step) {
      soaking.current = step;
      from.current.negative.copy(materials.negative.color);
      from.current.positive.copy(materials.positive.color);
      soaked.current = 0;
    }
    soaked.current = Math.min(1, soaked.current + delta / SOAK);
    Arr.forEach(["negative", "positive"] as const, (gram: Gram) => {
      const target = new Color(stainOf(gram, step));
      materials[gram].color
        .copy(from.current[gram])
        .lerp(target, soaked.current);
      materials[gram].opacity = step === "smear" ? 0.35 : 0.92;
    });
    if (soaked.current >= 1 && settled !== step) {
      setSettled(step);
    }
  });

  return (
    <>
      <SimulationTicker running={settled !== step} />
      <MicroscopeField>
        {Arr.flatMap(Arr.range(1, CLUSTERS), (cluster) => {
          const [x, z] = scatter(cluster, 1);
          return Arr.map(Arr.range(1, COCCI_PER_CLUSTER), (coccus) => (
            <mesh
              key={`${cluster}-${coccus}`}
              material={materials.positive}
              position={[
                x + (hashUnit(cluster, coccus) - 0.5) * 2.4,
                0,
                z + (hashUnit(coccus, cluster + 9) - 0.5) * 2.4,
              ]}
            >
              <sphereGeometry args={[COCCUS, 16, 12]} />
            </mesh>
          ));
        })}
        {Arr.map(Arr.range(1, RODS), (rod) => {
          const [x, z] = scatter(rod, 2);
          return (
            <mesh
              key={rod}
              material={materials.negative}
              position={[x, 0, z]}
              rotation={[Math.PI / 2, 0, hashUnit(rod, 5) * Math.PI]}
            >
              <capsuleGeometry args={[ROD.radius, ROD.length, 6, 12]} />
            </mesh>
          );
        })}
        {Arr.map(spirals, (spiral) => (
          <mesh
            geometry={spiral}
            key={spiral.uuid}
            material={materials.negative}
          />
        ))}
      </MicroscopeField>
    </>
  );
}
