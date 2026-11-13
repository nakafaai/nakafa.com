import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  frequency,
  orbitRadius,
  photonEnergy,
  visibleColor,
  wavelength,
} from "@repo/design-system/components/contents/chemistry/emission/spectrum";
import {
  MATH_NUMBER_OPTIONS,
  mathNumber,
} from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
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
import { Array as Arr, Option } from "effect";
import { type ReactNode, Suspense, useRef, useState } from "react";
import { Color, type Group, type Mesh } from "three";
import { useFormatter } from "use-intl";

/** How long one Bohr radius is in the scene. */
const BOHR = 0.16;

/** The highest level drawn. */
const TOP_LEVEL = 6;

/** How long one fall and its photon take while the card plays, in seconds. */
const CYCLE = 6;

/** The ends of the visible spectrum the strip spans, in nanometres. */
const VISIBLE = { end: 750, start: 380 } as const;

/** How wide the spectrum strip stands, in scene units. */
const STRIP = 9;

/** The words an emission lab reads from its lesson. */
type EmissionLabels = {
  /** The name of the toggle that chooses a fall, for assistive technology. */
  readonly choose: string;
  /** The readout of the photon's energy. */
  readonly energy: ReactNode;
  /** The readout of the photon's frequency. */
  readonly frequency: ReactNode;
  /** The readout of the fall between levels. */
  readonly transition: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
  /** The readout of the photon's wavelength. */
  readonly wavelength: ReactNode;
};

/** One fall the lesson offers, from an upper level to a lower one. */
type Fall = { readonly from: number; readonly to: number };

/**
 * Bohr's hydrogen atom: the electron circles on an orbit whose radius grows
 * as n^2, falls to a lower one, and sends out one photon whose wavelength the
 * Rydberg formula gives. Visible photons glow in their own color and mark
 * their line on the spectrum strip below; ultraviolet and infrared ones stay
 * faint, as the eye cannot see them. The footer reads the fall, the
 * wavelength, the photon's energy and its frequency.
 */
export function BohrEmissionLab({
  description,
  falls,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly falls: readonly Fall[];
  readonly labels: EmissionLabels;
  readonly title: ReactNode;
}) {
  const format = useFormatter();
  const offered = Arr.filter(
    falls,
    (fall) =>
      Number.isInteger(fall.from) &&
      Number.isInteger(fall.to) &&
      fall.to >= 1 &&
      fall.from > fall.to &&
      fall.from <= TOP_LEVEL
  );
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const key = (fall: Fall) => `${fall.from}-${fall.to}`;
  const shown = Arr.findFirst(offered, (fall) => key(fall) === chosen).pipe(
    Option.orElse(() => Arr.head(offered)),
    Option.getOrUndefined
  );

  if (shown === undefined) {
    return null;
  }

  const number = (value: number, digits: number) =>
    mathNumber(
      format.number(value, {
        ...MATH_NUMBER_OPTIONS,
        maximumFractionDigits: digits,
      })
    );
  const [mantissa, exponent] = format
    .number(frequency(shown.from, shown.to), {
      maximumFractionDigits: 2,
      notation: "scientific",
    })
    .split("E");

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      {offered.length > 1 ? (
        <VisualCardToolbar>
          <ToggleGroup
            aria-label={labels.choose}
            gridColumns={offered.length > 3 ? "4" : "3"}
            onValueChange={(value: string) => {
              if (value) {
                setChosen(value);
              }
            }}
            type="single"
            value={key(shown)}
            variant="outline"
          >
            {Arr.map(offered, (fall) => (
              <ToggleGroupItem
                aria-label={`${fall.from} - ${fall.to}`}
                key={key(fall)}
                value={key(fall)}
              >
                <InlineMath math={`${fall.from} \\rightarrow ${fall.to}`} />
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
        <ScienceStage reach={7} setting="space">
          <Suspense>
            <EmissionCamera />
            <BohrAtom fall={shown} key={key(shown)} />
            <SpectrumStrip falls={offered} shown={shown} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.transition}
            value={<InlineMath math={`n = ${shown.from} \\rightarrow n = ${shown.to}`} />}
          />
          <VisualFact
            label={labels.wavelength}
            value={
              <InlineMath
                math={`\\lambda = ${number(wavelength(shown.from, shown.to), 1)}\\ \\mathrm{nm}`}
              />
            }
          />
          <VisualFact
            label={labels.energy}
            value={
              <InlineMath
                math={`E = ${number(photonEnergy(shown.from, shown.to), 2)}\\ \\mathrm{eV}`}
              />
            }
          />
          <VisualFact
            label={labels.frequency}
            value={
              <InlineMath
                math={`f = ${mathNumber(mantissa ?? "")} \\times 10^{${exponent ?? ""}}\\ \\mathrm{Hz}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The color a photon of `nanometres` is drawn in: its own if visible, a faint grey if not. */
function photonColor(nanometres: number) {
  return Option.match(visibleColor(nanometres), {
    onNone: () => new Color(getColor("SLATE", 400)).multiplyScalar(0.6),
    onSome: ([red, green, blue]) =>
      new Color(red, green, blue).multiplyScalar(2.2),
  });
}

/**
 * The atom: the nucleus, the orbits n = 1 to 6, the electron, and the photon.
 * While the card plays the electron circles its upper orbit, falls, and the
 * photon travels out as a wave; paused, the electron rests on the lower orbit
 * with the photon on its way.
 */
function BohrAtom({ fall }: { readonly fall: Fall }) {
  const playing = useVisualScene((card) => card.playing, false);
  const electron = useRef<Mesh>(null);
  const photon = useRef<Group>(null);
  const nanometres = wavelength(fall.from, fall.to);
  const color = photonColor(nanometres);
  const shown = Math.min(1.2, (0.55 * nanometres) / 656);
  const wave = Arr.map(Arr.range(0, 160), (step) => {
    const x = (step / 160) * 3;
    return [x, 0.18 * Math.sin((2 * Math.PI * x) / shown), 0] as const;
  });

  useFrame((state) => {
    const time = playing ? (state.clock.elapsedTime % CYCLE) / CYCLE : 0.75;
    const falling = Math.min(1, Math.max(0, (time - 0.4) / 0.12));
    const radius =
      BOHR *
      (orbitRadius(fall.from) +
        (orbitRadius(fall.to) - orbitRadius(fall.from)) * falling);
    const angle = state.clock.elapsedTime * (playing ? 1.4 : 0) + 0.6;
    electron.current?.position.set(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0
    );
    if (photon.current !== null) {
      const flight = Math.max(0, (time - 0.5) / 0.5);
      photon.current.visible = time >= 0.5;
      photon.current.position.set(
        radius * Math.cos(angle) + flight * 6,
        radius * Math.sin(angle),
        0
      );
    }
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.09, 24, 16]} />
        <meshStandardMaterial
          color={getColor("WHITE")}
          emissive={getColor("WHITE")}
          emissiveIntensity={2.5}
        />
      </mesh>
      {Arr.map(Arr.range(1, TOP_LEVEL), (level) => (
        <mesh key={level}>
          <torusGeometry args={[BOHR * orbitRadius(level), 0.012, 8, 160]} />
          <meshStandardMaterial
            color={getColor("SLATE", level === fall.from || level === fall.to ? 200 : 600)}
            emissive={getColor("SLATE", 400)}
            emissiveIntensity={level === fall.from || level === fall.to ? 0.6 : 0.1}
          />
        </mesh>
      ))}
      <mesh ref={electron}>
        <sphereGeometry args={[0.11, 20, 14]} />
        <meshBasicMaterial color={new Color(getColor("SLATE", 200)).multiplyScalar(2)} toneMapped={false} />
      </mesh>
      <group ref={photon}>
        <Line color={color} lineWidth={2.4} points={wave} toneMapped={false} />
      </group>
    </group>
  );
}

/**
 * The visible spectrum as a strip of thin slices, each in its own color, with
 * a bright line at every offered fall that lands in it and a taller one at the
 * fall shown.
 */
function SpectrumStrip({
  falls,
  shown,
}: {
  readonly falls: readonly Fall[];
  readonly shown: Fall;
}) {
  const slices = Arr.map(Arr.range(0, 73), (slice) => {
    const nanometres = VISIBLE.start + slice * 5;
    return { color: photonColor(nanometres).multiplyScalar(0.18), nanometres };
  });
  const place = (nanometres: number) =>
    ((nanometres - VISIBLE.start) / (VISIBLE.end - VISIBLE.start) - 0.5) * STRIP;

  return (
    <group position={[0, -6.4, 0]}>
      {Arr.map(slices, (slice) => (
        <mesh key={slice.nanometres} position={[place(slice.nanometres + 2.5), 0, 0]}>
          <boxGeometry args={[(STRIP * 5) / (VISIBLE.end - VISIBLE.start), 0.5, 0.05]} />
          <meshBasicMaterial color={slice.color} toneMapped={false} />
        </mesh>
      ))}
      {Arr.flatMap(falls, (fall) => {
        const nanometres = wavelength(fall.from, fall.to);
        const current = fall.from === shown.from && fall.to === shown.to;
        return Option.isSome(visibleColor(nanometres))
          ? [
              <mesh
                key={`${fall.from}-${fall.to}`}
                position={[place(nanometres), 0, 0.03]}
              >
                <boxGeometry args={[0.05, current ? 0.9 : 0.5, 0.05]} />
                <meshBasicMaterial color={photonColor(nanometres)} toneMapped={false} />
              </mesh>,
            ]
          : [];
      })}
    </group>
  );
}

/** Faces the atom and its spectrum, farther back on a narrow card. */
function EmissionCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 22 : 17;
  return (
    <CameraControls
      cameraPosition={[1.5, 1.5, distance]}
      cameraTarget={[0.8, -1, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={3}
    />
  );
}
