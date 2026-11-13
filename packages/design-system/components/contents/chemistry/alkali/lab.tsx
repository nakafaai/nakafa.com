import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  floats,
  getMetal,
  type MetalId,
  MetalIdSchema,
  melts,
  pieceAt,
  stillMoment,
} from "@repo/design-system/components/contents/chemistry/alkali/metals";
import { toggleColumns } from "@repo/design-system/components/contents/chemistry/columns";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import {
  GlassMaterial,
  LiquidMaterial,
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
import {
  createRef,
  type ReactNode,
  Suspense,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color, type Mesh, MeshPhysicalMaterial, Vector2 } from "three";
import { useFormatter } from "use-intl";

/** A 600 mL Griffin beaker, in metres: 90 mm across, 125 mm tall, its glass 2 mm thick. */
const BEAKER = {
  base: 0.003,
  height: 0.125,
  inner: 0.043,
  outer: 0.045,
} as const;

/** The beaker's wall, from the middle of its base out and up to the lip, turned around its axis. */
const BEAKER_WALL = Arr.map(
  [
    [0.001, 0],
    [BEAKER.inner, 0],
    [BEAKER.outer, BEAKER.base],
    [BEAKER.outer, BEAKER.height - 0.002],
    [BEAKER.outer + 0.002, BEAKER.height],
  ] as const,
  ([radius, height]) => new Vector2(radius, height)
);

/** How deep 400 mL of water stands in the beaker, in metres. */
const LEVEL = 400e-6 / (Math.PI * BEAKER.inner ** 2);

/** The white glazed tile under the beaker, which shows the pink, in metres. */
const TILE = { side: 0.15, thick: 0.008 } as const;

/** The printed graduations, every 100 mL up to 500 mL, as heights above the inner bottom. */
const MARKS = Arr.map(
  Arr.range(1, 5),
  (step) => (step * 100e-6) / (Math.PI * BEAKER.inner ** 2)
);

/** How long one run lasts while the card plays, in seconds. */
const RUN = 10;

/** How many bubbles a fully active metal keeps rising at once. */
const BUBBLES = 36;

/** The words a metal-in-water lab reads from its lesson. */
interface AlkaliLabels {
  /** The name of the toggle that chooses a metal, for assistive technology. */
  readonly choose: string;
  /** The readout of the density. */
  readonly density: ReactNode;
  /** The readout of the equation. */
  readonly equation: ReactNode;
  /** The readout of the first ionization energy. */
  readonly ionization: ReactNode;
  /** The readout of the melting point. */
  readonly melting: ReactNode;
  /** The readout of the atomic radius. */
  readonly radius: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * A 600 mL beaker of water with a few drops of phenolphthalein on a white
 * tile, at its real size on a lab bench, and a pea-sized piece of metal
 * dropped in. A metal lighter than water floats and skates about on its
 * hydrogen; a heavier one sinks. A metal that melts below boiling water melts
 * into a ball, potassium lights its hydrogen with a lilac flame, calcium
 * clouds the water with its hydroxide, and the water turns pink as hydroxide
 * forms, fastest for the most reactive metal. A paused card shows the run
 * when most of the piece has reacted. The footer reads the measured
 * properties behind the trend and, on a line of its own, the equation.
 *
 * @param metals - The metals to offer, in order
 */
export function AlkaliWaterLab({
  description,
  labels,
  metals,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: AlkaliLabels;
  readonly metals: readonly MetalId[];
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const offered = Arr.filter(metals, (id) => Schema.is(MetalIdSchema)(id));
  const [chosen, setChosen] = useState<MetalId | undefined>(undefined);
  const shown = Arr.findFirst(offered, (id) => id === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const metal = getMetal(shown);
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

      {offered.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.choose}
            gridColumns={toggleColumns(offered.length)}
            onValueChange={(value: string) => {
              if (Schema.is(MetalIdSchema)(value)) {
                setChosen(value);
              }
            }}
            type="single"
            value={shown}
            variant="outline"
          >
            {Arr.map(offered, (id) => (
              <ToggleGroupItem
                aria-label={getMetal(id).symbol}
                key={id}
                value={id}
              >
                <InlineMath math={`\\mathrm{${getMetal(id).symbol}}`} />
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
        <ScienceStage floor={0} reach={0.2} setting="lab">
          <Suspense>
            <BeakerCamera />
            <Beaker key={shown} metalId={shown} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.ionization}
            value={
              <InlineMath
                math={`I_1 = ${number(metal.ionization, 0)}\\ \\mathrm{kJ/mol}`}
              />
            }
          />
          <VisualFact
            label={labels.radius}
            value={
              <InlineMath
                math={`r = ${number(metal.radius, 0)}\\ \\mathrm{pm}`}
              />
            }
          />
          <VisualFact
            label={labels.density}
            value={
              <InlineMath
                math={`\\rho = ${number(metal.density, 2)}\\ \\mathrm{g/cm^3}`}
              />
            }
          />
          <VisualFact
            label={labels.melting}
            value={
              <InlineMath
                math={`T_m = ${number(metal.melting, 1)}\\ ^{\\circ}\\mathrm{C}`}
              />
            }
          />
          <VisualFact
            label={labels.equation}
            value={<InlineMath math={metal.equation} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The tile, the beaker and its graduations, the water and its color, the
 * piece of metal, its bubbles and, for potassium, its flame. Time runs while
 * the card plays and rests on the outcome while it is paused.
 */
function Beaker({ metalId }: { readonly metalId: MetalId }) {
  const metal = getMetal(metalId);
  const playing = useVisualScene((card) => card.playing, false);
  const pieceRef = useRef<Mesh>(null);
  const flame = useRef<Mesh>(null);
  const water = useRef<Mesh>(null);
  const bubbles = useMemo(
    () =>
      Arr.map(
        Arr.range(1, Math.max(1, Math.round(BUBBLES * metal.activity))),
        (index) => ({
          offset: (index * 0.618) % 1,
          ref: createRef<Mesh>(),
          spread: ((index * 0.381) % 1) - 0.5,
        })
      ),
    [metal.activity]
  );
  const floating = floats(metalId);
  const still = stillMoment(metalId, RUN);
  const room = BEAKER.inner * 0.6;

  useFrame((state) => {
    const seconds = playing ? state.clock.elapsedTime % RUN : still;
    const piece = pieceAt(metalId, seconds, RUN, LEVEL, room);
    placePiece(pieceRef.current, piece, melts(metalId));
    placeFlame(flame.current, piece, metal.flame, seconds);
    tintWater(water.current, piece.used, metal.milky);
    for (const bubble of bubbles) {
      const rise = (seconds * (0.8 + metal.activity) + bubble.offset) % 1;
      placeBubble(bubble.ref.current, piece, bubble.spread, {
        floating,
        rise,
        surface: LEVEL,
      });
    }
  });

  return (
    <group>
      <mesh position={[0, TILE.thick / 2, 0]} receiveShadow>
        <boxGeometry args={[TILE.side, TILE.thick, TILE.side]} />
        <meshPhysicalMaterial
          clearcoat={0.8}
          color={getColor("ZINC", 100)}
          roughness={0.3}
        />
      </mesh>
      <group position={[0, TILE.thick, 0]}>
        <mesh castShadow>
          <latheGeometry args={[BEAKER_WALL, 48]} />
          <GlassMaterial color={getColor("SLATE", 200)} opacity={0.22} />
        </mesh>
        {Arr.map(MARKS, (height) => (
          <Line
            color={getColor("ZINC", 100)}
            key={height}
            lineWidth={1.2}
            points={Arr.map(Arr.range(0, 12), (step) => {
              const angle = Math.PI / 2 - 0.35 + (0.7 * step) / 12;
              return [
                (BEAKER.outer + 0.0003) * Math.cos(angle),
                BEAKER.base + height,
                (BEAKER.outer + 0.0003) * Math.sin(angle),
              ] as const;
            })}
          />
        ))}
        <group position={[0, BEAKER.base, 0]}>
          <mesh position={[0, LEVEL / 2, 0]} ref={water}>
            <cylinderGeometry
              args={[BEAKER.inner - 0.0004, BEAKER.inner - 0.0004, LEVEL, 48]}
            />
            <LiquidMaterial color={getColor("SLATE", 50)} opacity={0.3} />
          </mesh>
          <mesh castShadow ref={pieceRef}>
            <dodecahedronGeometry args={[1, 1]} />
            <MetalMaterial
              color={getColor("SLATE", 300)}
              roughness={metal.milky ? 0.55 : 0.3}
            />
          </mesh>
          <mesh ref={flame}>
            <coneGeometry args={[0.0035, 0.016, 24, 1, true]} />
            <meshBasicMaterial
              color={new Color(PLOT_COLORS.violet).multiplyScalar(2.2)}
              depthWrite={false}
              opacity={0.7}
              toneMapped={false}
              transparent
            />
          </mesh>
          {Arr.map(bubbles, (bubble) => (
            <mesh key={bubble.offset} ref={bubble.ref}>
              <sphereGeometry args={[0.0011, 10, 8]} />
              <GlassMaterial color={getColor("SLATE", 50)} opacity={0.6} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** Where the piece is at one moment of the run. */
type Piece = ReturnType<typeof pieceAt>;

/** The clear water, and the tints its hydroxide gives it. */
const WATER_TINTS = {
  clear: new Color(getColor("SLATE", 50)),
  milky: new Color(getColor("ZINC", 100)),
  pink: new Color(PLOT_COLORS.pink),
} as const;

/**
 * Turns the water pink as hydroxide forms, or milky for a hydroxide too
 * little soluble to stay dissolved, the more of the piece has reacted.
 */
function tintWater(mesh: Mesh | null, used: number, milky: boolean) {
  const material = mesh?.material;
  if (!(material instanceof MeshPhysicalMaterial)) {
    return;
  }
  const share = Math.min(1, used * 1.4);
  material.color
    .copy(WATER_TINTS.clear)
    .lerp(milky ? WATER_TINTS.milky : WATER_TINTS.pink, 0.8 * share);
  material.opacity = 0.3 + (milky ? 0.55 : 0.3) * share;
}

/** Stands the piece at its place, a ball once a metal melts in its own heat. */
function placePiece(mesh: Mesh | null, piece: Piece, melted: boolean) {
  if (mesh === null) {
    return;
  }
  mesh.position.set(piece.x, piece.y, piece.z);
  mesh.scale.set(
    piece.size,
    melted ? piece.size : piece.size * 0.7,
    piece.size
  );
  mesh.visible = piece.used < 0.995;
}

/** Flickers the flame above a piece whose hydrogen catches fire. */
function placeFlame(
  mesh: Mesh | null,
  piece: Piece,
  burns: boolean,
  seconds: number
) {
  if (mesh === null) {
    return;
  }
  mesh.visible = burns && piece.used < 0.97;
  mesh.position.set(piece.x, piece.y + 0.009, piece.z);
  mesh.scale.set(1, 0.8 + 0.25 * Math.sin(seconds * 23), 1);
}

/**
 * Lifts one bubble of hydrogen: round a floating piece it froths just above
 * the surface, from a sunken one it rises to the surface, while the piece
 * still reacts.
 */
function placeBubble(
  mesh: Mesh | null,
  piece: Piece,
  spread: number,
  rising: {
    readonly floating: boolean;
    readonly rise: number;
    readonly surface: number;
  }
) {
  if (mesh === null) {
    return;
  }
  mesh.position.set(
    piece.x + spread * piece.size * 3,
    rising.floating
      ? rising.surface + rising.rise * 0.006
      : piece.y + rising.rise * (rising.surface - piece.y),
    piece.z + spread * piece.size * 1.5
  );
  mesh.visible = piece.used < 0.995;
}

/** Looks into the beaker from the front and above, farther back on a narrow card. */
function BeakerCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.42 : 0.32;
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.62, distance * 0.78]}
      cameraTarget={[0, 0.06, 0]}
      fov={36}
      maxDistance={distance * 2}
      minDistance={0.14}
    />
  );
}
