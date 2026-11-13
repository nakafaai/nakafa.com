import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  ladderOf,
  type Point,
  type Rung,
} from "@repo/design-system/components/contents/biology/dna/ladder";
import {
  type Base,
  basesOf,
  complementOf,
  copiedCount,
  differencesOf,
  gcShareOf,
  identityOf,
  type Nucleic,
  spanOf,
  turnsOf,
} from "@repo/design-system/components/contents/biology/dna/strand";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CatmullRomCurve3, type Group, Quaternion, Vector3 } from "three";

/** Each base keeps one colour in every lesson, from the plot palette. */
const BASE_COLORS = {
  A: PLOT_COLORS.amber,
  C: PLOT_COLORS.pink,
  G: PLOT_COLORS.violet,
  T: PLOT_COLORS.teal,
  U: PLOT_COLORS.orange,
} as const satisfies Record<Base, string>;

/** A card narrower than this width-to-height ratio gets the farther camera. */
const NARROW_ASPECT = 1.2;

/** Played, copying a stretch takes ten seconds. */
const COPY_SECONDS = 10;

/**
 * A stretch of DNA or RNA built base by base at B-DNA's real geometry: 0.34 nm
 * per base pair, 10.5 pairs a turn, 2 nm across, with its minor and major
 * grooves. With a `variant`, the reader switches between two sequences and
 * the changed bases glow; with `copy`, a slider opens the helix from one end
 * and new nucleotides pair with both parents, as in replication. An RNA
 * genome stands as one strand until it is copied.
 */
export function DnaHelixLab({
  copy = false,
  description,
  genome,
  labels,
  nucleic = "dna",
  sequence,
  title,
  variant,
}: {
  readonly copy?: boolean;
  readonly description: ReactNode;
  readonly genome?: number;
  readonly labels: {
    readonly choose?: string;
    readonly copied?: ReactNode;
    readonly copy?: string;
    readonly differences?: ReactNode;
    readonly gc?: ReactNode;
    readonly identity?: ReactNode;
    readonly share?: ReactNode;
    readonly whole?: ReactNode;
    readonly length: ReactNode;
    readonly span: ReactNode;
    readonly strands?: Readonly<{ first: ReactNode; second: ReactNode }>;
    readonly turns?: ReactNode;
    readonly viewLabel: string;
  };
  readonly nucleic?: Nucleic;
  readonly sequence: string;
  readonly title: ReactNode;
  readonly variant?: string;
}) {
  const [shown, setShown] = useState<"first" | "second">("first");
  const [share, setShare] = useState(copy ? 0.5 : 0);
  const first = useMemo(() => basesOf(sequence, nucleic), [nucleic, sequence]);
  const second = useMemo(
    () => (variant === undefined ? first : basesOf(variant, nucleic)),
    [first, nucleic, variant]
  );
  const bases = shown === "first" ? first : second;
  const changed = useMemo(
    () => Arr.map(bases, (_, index) => second[index] !== first[index]),
    [bases, first, second]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {(variant !== undefined || copy) && (
        <VisualCardToolbar>
          {variant !== undefined && labels.strands && (
            <ToggleGroup
              aria-label={labels.choose}
              onValueChange={(value: string) =>
                setShown(value === "second" ? "second" : "first")
              }
              type="single"
              value={shown}
              variant="outline"
            >
              <ToggleGroupItem value="first">
                {labels.strands.first}
              </ToggleGroupItem>
              <ToggleGroupItem value="second">
                {labels.strands.second}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {copy && (
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span>{labels.copy}</span>
                <span className="tabular-nums">{Math.round(share * 100)}%</span>
              </div>
              <Slider
                aria-label={labels.copy}
                max={1}
                min={0}
                onValueChange={setShare}
                step={0.01}
                value={share}
              />
            </div>
          )}
        </VisualCardToolbar>
      )}

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={6} setting="studio">
          <Suspense fallback={null}>
            <HelixCamera />
            <HelixScene
              bases={bases}
              changed={changed}
              copy={copy}
              nucleic={nucleic}
              onShare={setShare}
              share={copy ? share : 0}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <HelixFacts
          bases={bases}
          copy={copy}
          first={first}
          genome={genome}
          labels={labels}
          nucleic={nucleic}
          second={variant === undefined ? undefined : second}
          share={share}
        />
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The footer's readings. Every card counts its bases; double-stranded DNA
 * gives its length at 0.34 nm a pair, then the differences between two
 * sequences, the copying progress, or its turns and G and C share. A single
 * RNA strand has no fixed rise or turn, so it gives its G and C share and,
 * with `genome`, how much of the whole genome the stretch shows.
 */
function HelixFacts({
  bases,
  copy,
  first,
  genome,
  labels,
  nucleic,
  second,
  share,
}: {
  readonly bases: readonly Base[];
  readonly copy: boolean;
  readonly first: readonly Base[];
  readonly genome: number | undefined;
  readonly labels: Readonly<{
    copied?: ReactNode;
    differences?: ReactNode;
    gc?: ReactNode;
    identity?: ReactNode;
    length: ReactNode;
    share?: ReactNode;
    span?: ReactNode;
    turns?: ReactNode;
    whole?: ReactNode;
  }>;
  readonly nucleic: Nucleic;
  readonly second: readonly Base[] | undefined;
  readonly share: number;
}) {
  const quantity = useQuantity();
  const count = bases.length;
  const single = nucleic === "rna" && !copy;
  return (
    <VisualCardFacts>
      <VisualFactTabular
        label={labels.length}
        value={<InlineMath math={quantity(count, "", 0)} />}
      />
      {!single && (
        <VisualFactTabular
          label={labels.span}
          value={
            <InlineMath math={quantity(spanOf(count), "\\text{ nm}", 1)} />
          }
        />
      )}
      {second !== undefined && (
        <>
          <VisualFactTabular
            label={labels.differences}
            value={
              <InlineMath
                math={quantity(differencesOf(first, second), "", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.identity}
            value={
              <InlineMath
                math={quantity(identityOf(first, second) * 100, "\\%", 1)}
              />
            }
          />
        </>
      )}
      {second === undefined && copy && (
        <VisualFactTabular
          label={labels.copied}
          value={
            <InlineMath math={quantity(copiedCount(count, share), "", 0)} />
          }
        />
      )}
      {second === undefined && !single && (
        <VisualFactTabular
          label={labels.turns}
          value={<InlineMath math={quantity(turnsOf(count), "", 1)} />}
        />
      )}
      {second === undefined && !copy && (
        <VisualFactTabular
          label={labels.gc}
          value={
            <InlineMath math={quantity(gcShareOf(bases) * 100, "\\%", 0)} />
          }
        />
      )}
      {single && genome !== undefined && (
        <>
          <VisualFactTabular
            label={labels.whole}
            value={<InlineMath math={quantity(genome, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.share}
            value={
              <InlineMath math={quantity((count / genome) * 100, "\\%", 2)} />
            }
          />
        </>
      )}
    </VisualCardFacts>
  );
}

/**
 * The strand or strands, their bases and the sequence written along them.
 * Played, the helix spins on its axis; a copying card runs its progress
 * instead and hands it to the card.
 */
function HelixScene({
  bases,
  changed,
  copy,
  nucleic,
  onShare,
  share,
}: {
  readonly bases: readonly Base[];
  readonly changed: readonly boolean[];
  readonly copy: boolean;
  readonly nucleic: Nucleic;
  readonly onShare: (share: number) => void;
  readonly share: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const spin = useRef<Group>(null);
  const progress = useRef(share);
  const sent = useRef(share);
  const ladder = useMemo(
    () => ladderOf(bases.length, share),
    [bases.length, share]
  );
  const single = nucleic === "rna";
  const middle = ((bases.length - 1) * 0.34) / 2;

  useEffect(() => {
    if (share !== sent.current) {
      progress.current = share;
      sent.current = share;
    }
  }, [share]);

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    const step = Math.min(delta, 0.1);
    if (!copy) {
      if (spin.current) {
        spin.current.rotation.x += step * 0.5;
      }
      return;
    }
    progress.current = (progress.current + step / COPY_SECONDS) % 1.1;
    const shown = Math.min(1, Math.round(progress.current * 50) / 50);
    if (shown !== sent.current) {
      sent.current = shown;
      onShare(shown);
    }
  });

  const ink = useLabelInk();

  return (
    <>
      <SimulationTicker running={playing} />
      <group position={[-middle, 0, 0]}>
        <group ref={spin}>
          <Backbone
            color={MATERIAL.phosphate}
            points={Arr.map(ladder, (rung) => rung.first)}
          />
          {!(single && share === 0) && (
            <Backbone
              color={single ? MATERIAL.phosphateNew : MATERIAL.phosphate}
              points={Arr.map(ladder, (rung) => rung.second)}
            />
          )}
          <NewStrands ladder={ladder} />
          {Arr.map(ladder, (rung) => (
            <Pair
              base={bases[rung.index] ?? "A"}
              changed={changed[rung.index] === true}
              key={rung.index}
              nucleic={nucleic}
              rung={rung}
              single={single}
            />
          ))}
        </group>
        {Arr.map(ladder, (rung) => (
          <ThreeLabel
            color={ink}
            fontSize="compact"
            key={rung.index}
            position={[rung.index * 0.34, rung.open ? 3.2 : 1.7, 0]}
          >
            {bases[rung.index]}
          </ThreeLabel>
        ))}
      </group>
    </>
  );
}

/**
 * The camera on the helix: farther back on a narrow card, such as a phone's
 * square frame, so the whole stretch and its letters stay in view.
 */
function HelixCamera() {
  const size = useThree((state) => state.size);
  return (
    <CameraControls
      cameraPosition={
        isNarrowThreeScene(size, NARROW_ASPECT) ? [0, 1.6, 20] : [0, 1.6, 14]
      }
      cameraTarget={[0, 0, 0]}
      fov={34}
      maxDistance={30}
      minDistance={4}
    />
  );
}

/** One strand's sugar-phosphate backbone, a smooth tube through its points. */
function Backbone({
  color,
  points,
}: {
  readonly color: string;
  readonly points: readonly Point[];
}) {
  const curve = useMemo(
    () =>
      points.length < 2
        ? undefined
        : new CatmullRomCurve3(
            Arr.map(points, ([x, y, z]) => new Vector3(x, y, z))
          ),
    [points]
  );
  if (curve === undefined) {
    return null;
  }
  return (
    <mesh castShadow>
      <tubeGeometry args={[curve, points.length * 8, 0.13, 10, false]} />
      <meshPhysicalMaterial clearcoat={0.5} color={color} roughness={0.4} />
    </mesh>
  );
}

/** The new backbones the polymerase has laid, one beside each parent. */
function NewStrands({ ladder }: { readonly ladder: readonly Rung[] }) {
  const copied = Arr.filter(ladder, (rung) => rung.copied);
  return (
    <>
      <Backbone
        color={MATERIAL.phosphateNew}
        points={Arr.map(copied, (rung) => rung.newFirst)}
      />
      <Backbone
        color={MATERIAL.phosphateNew}
        points={Arr.map(copied, (rung) => rung.newSecond)}
      />
    </>
  );
}

/**
 * One base pair: the parent's base reaching in from its backbone and its
 * partner reaching back, joined in the middle. An opened pair shows each
 * parent's base waiting, or paired with its new partner once copied; a
 * changed base glows.
 */
function Pair({
  base,
  changed,
  nucleic,
  rung,
  single,
}: {
  readonly base: Base;
  readonly changed: boolean;
  readonly nucleic: Nucleic;
  readonly rung: Rung;
  readonly single: boolean;
}) {
  const partner = complementOf(base, nucleic);
  if (!rung.open) {
    const middle = midpoint(rung.first, rung.second);
    return (
      <>
        <Rod
          color={BASE_COLORS[base]}
          from={rung.first}
          glow={changed}
          to={single ? stub(rung.first, rung.second) : middle}
        />
        {!single && (
          <Rod
            color={BASE_COLORS[partner]}
            from={rung.second}
            glow={changed}
            to={middle}
          />
        )}
      </>
    );
  }
  const upper = rung.copied ? rung.newFirst : stub(rung.first, rung.newFirst);
  const lower = rung.copied
    ? rung.newSecond
    : stub(rung.second, rung.newSecond);
  return (
    <>
      <Rod
        color={BASE_COLORS[base]}
        from={rung.first}
        glow={changed}
        to={midpoint(rung.first, upper)}
      />
      {rung.copied && (
        <Rod
          color={BASE_COLORS[partner]}
          from={rung.newFirst}
          glow={false}
          to={midpoint(rung.first, upper)}
        />
      )}
      {!single && (
        <>
          <Rod
            color={BASE_COLORS[partner]}
            from={rung.second}
            glow={false}
            to={midpoint(rung.second, lower)}
          />
          {rung.copied && (
            <Rod
              color={BASE_COLORS[base]}
              from={rung.newSecond}
              glow={false}
              to={midpoint(rung.second, lower)}
            />
          )}
        </>
      )}
    </>
  );
}

/** A base drawn as a rounded rod between two points. */
function Rod({
  color,
  from,
  glow,
  to,
}: {
  readonly color: string;
  readonly from: Point;
  readonly glow: boolean;
  readonly to: Point;
}) {
  const start = new Vector3(from[0], from[1], from[2]);
  const end = new Vector3(to[0], to[1], to[2]);
  const length = start.distanceTo(end);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 1, 0),
    end.clone().sub(start).normalize()
  );
  const center = start.add(end).multiplyScalar(0.5);
  return (
    <mesh castShadow position={center} quaternion={quaternion}>
      <capsuleGeometry args={[0.1, Math.max(0.01, length - 0.2), 4, 10]} />
      <meshPhysicalMaterial
        clearcoat={0.4}
        color={color}
        emissive={color}
        emissiveIntensity={glow ? 1.6 : 0}
        roughness={0.4}
      />
    </mesh>
  );
}

/** The point halfway between two points. */
function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/** A base on a lone strand reaches 45% of the way to where its partner would be. */
function stub(from: Point, toward: Point): Point {
  return [
    from[0] + (toward[0] - from[0]) * 0.45,
    from[1] + (toward[1] - from[1]) * 0.45,
    from[2] + (toward[2] - from[2]) * 0.45,
  ];
}
