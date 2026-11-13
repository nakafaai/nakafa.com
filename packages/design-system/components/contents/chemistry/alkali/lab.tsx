import { useFrame, useThree } from "@react-three/fiber";
import {
  floats,
  getMetal,
  type MetalId,
  MetalIdSchema,
  pieceAt,
} from "@repo/design-system/components/contents/chemistry/alkali/metals";
import { toggleColumns } from "@repo/design-system/components/contents/chemistry/columns";
import { ELEMENTS } from "@repo/design-system/components/contents/chemistry/molecule/elements";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { GlassMaterial } from "@repo/design-system/components/three/physical";
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
import { Color, type Mesh, type MeshPhysicalMaterial } from "three";
import { useFormatter } from "use-intl";

/** The inside of the glass trough, in centimetres: wide, deep and tall. */
const TROUGH = { depth: 10, height: 6, width: 16 } as const;

/** How deep the water stands in the trough, in centimetres. */
const WATER = 4.2;

/** How long one run lasts while the card plays, in seconds. */
const RUN = 10;

/** The moment of the run a paused card shows. */
const STILL = 3.5;

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
  /** The readout of the atomic radius. */
  readonly radius: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * A glass trough of water with a few drops of phenolphthalein, and a small
 * piece of metal dropped in. A metal lighter than water floats and skims
 * about on its hydrogen; a heavier one sinks. A brisk metal melts into a ball,
 * potassium lights its hydrogen with a lilac flame, calcium clouds the water
 * with its hydroxide, and the water turns pink as hydroxide forms, fastest for
 * the most reactive metal. The footer reads the equation and the measured
 * properties behind the trend.
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
        <ScienceStage floor={0} reach={11} setting="lab">
          <Suspense>
            <TroughCamera />
            <Trough key={shown} metalId={shown} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.equation}
            value={<InlineMath math={metal.equation} />}
          />
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
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The trough, the water and its color, the piece of metal, its bubbles and,
 * for potassium, its flame. Time runs while the card plays and rests at a
 * moment early in the run while it is paused.
 */
function Trough({ metalId }: { readonly metalId: MetalId }) {
  const metal = getMetal(metalId);
  const playing = useVisualScene((card) => card.playing, false);
  const pieceRef = useRef<Mesh>(null);
  const flame = useRef<Mesh>(null);
  const water = useRef<MeshPhysicalMaterial>(null);
  const clear = useMemo(() => new Color(getColor("SLATE", 200)), []);
  const pink = useMemo(() => new Color(PLOT_COLORS.pink), []);
  const milk = useMemo(() => new Color(getColor("SLATE", 50)), []);
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

  useFrame((state) => {
    const seconds = playing ? state.clock.elapsedTime % RUN : STILL;
    const piece = pieceAt(metalId, seconds, RUN, WATER);
    placePiece(pieceRef.current, piece, metal.melts);
    placeFlame(flame.current, piece, metal.flame, seconds);
    if (water.current !== null) {
      const tint = metal.milky ? milk : pink;
      water.current.color
        .copy(clear)
        .lerp(tint, Math.min(0.85, piece.used * 1.2));
      water.current.opacity = metal.milky ? 0.62 + 0.3 * piece.used : 0.62;
    }
    for (const bubble of bubbles) {
      const rise = (seconds * (0.8 + metal.activity) + bubble.offset) % 1;
      placeBubble(bubble.ref.current, piece, bubble.spread, {
        floating,
        rise,
        surface: WATER,
      });
    }
  });

  return (
    <group>
      <mesh position={[0, TROUGH.height / 2, 0]}>
        <boxGeometry args={[TROUGH.width, TROUGH.height, TROUGH.depth]} />
        <GlassMaterial color={getColor("SLATE", 200)} opacity={0.18} />
      </mesh>
      <mesh position={[0, WATER / 2, 0]}>
        <boxGeometry args={[TROUGH.width - 0.2, WATER, TROUGH.depth - 0.2]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={getColor("SLATE", 200)}
          depthWrite={false}
          ior={1.33}
          opacity={0.62}
          ref={water}
          roughness={0.1}
          transparent
        />
      </mesh>
      <mesh castShadow ref={pieceRef}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={ELEMENTS[metal.symbol].color}
          metalness={0.8}
          roughness={0.35}
        />
      </mesh>
      <mesh ref={flame}>
        <coneGeometry args={[0.35, 1.4, 24, 1, true]} />
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
          <sphereGeometry args={[0.07, 10, 8]} />
          <GlassMaterial color={getColor("SLATE", 50)} opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Where the piece is at one moment of the run. */
type Piece = ReturnType<typeof pieceAt>;

/** Stands the piece at its place, a ball once a brisk metal melts. */
function placePiece(mesh: Mesh | null, piece: Piece, melts: boolean) {
  if (mesh === null) {
    return;
  }
  mesh.position.set(piece.x, piece.y, piece.z);
  mesh.scale.set(piece.size, melts ? piece.size : piece.size * 0.7, piece.size);
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
  mesh.position.set(piece.x, piece.y + 0.9, piece.z);
  mesh.scale.set(1, 0.8 + 0.25 * Math.sin(seconds * 23), 1);
}

/** Lifts one bubble from the piece to the surface, while the piece still reacts. */
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
    piece.x + spread * piece.size * 2,
    rising.floating
      ? rising.surface + rising.rise * 0.5
      : piece.y + rising.rise * (rising.surface - piece.y),
    piece.z + spread * piece.size
  );
  mesh.visible = piece.used < 0.995;
}

/** Looks into the trough from the front and above, closer on a wide card. */
function TroughCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 24 : 16;
  return (
    <CameraControls
      cameraPosition={[0, distance * 0.55, distance * 0.82]}
      cameraTarget={[0, 2.5, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={6}
    />
  );
}
