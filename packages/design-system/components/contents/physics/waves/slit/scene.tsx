import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import {
  fringeStart,
  SCREEN_HALF,
  screenMarks,
} from "@repo/design-system/components/contents/physics/waves/slit/screen";
import { Beam } from "@repo/design-system/components/three/optic/beam";
import {
  Backboard,
  Rail,
  Rider,
  Screen,
} from "@repo/design-system/components/three/optic/bench";
import {
  Fringes,
  SLIDE_DROP,
  Slits,
  Spread,
} from "@repo/design-system/components/three/optic/slit";
import {
  LASER_DROP,
  Laser,
} from "@repo/design-system/components/three/optic/source";
import { View } from "@repo/design-system/components/three/optic/view";
import { PrintFace } from "@repo/design-system/components/three/print/layer";
import { usePrintNumber } from "@repo/design-system/components/three/print/number";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** How high above the benchtop the optical axis runs. */
const AXIS = 1.3;

/** How long the bench is, where along it the slits stand, and how many scene units one centimetre takes. */
const LENGTH = 7.2;
const SLITS_AT = -1.9;
const UNIT = 0.0155;

/** How far in front of the slits the aperture of the laser is. */
const THROW = 0.8;

/** The screen, the band of fringes on it, and where its scale, its count and its span are printed. */
const CARD = { tall: 1.8, wide: 2.6 } as const;
const BAND = { at: 0.12, tall: 0.7, wide: 2.3 } as const;
const PRINT = { dots: 0.56, scale: -0.3, span: -0.62, wide: BAND.wide };

/**
 * The side the bench is read from: from over the laser, looking along the
 * light at the face of the screen, where the fringes are counted. From that
 * high the slide stands below the fringes and their scale, not in front.
 */
const FROM = [-6, 2.9, 0.7] as const;

/**
 * How far the slits and the laser show below the axis of the screen from
 * that side, for every scene unit they stand in front of it: the fall of
 * the line of sight, and half as much again because they are nearer.
 */
const FALL = (1.5 * FROM[1]) / Math.hypot(FROM[0], FROM[2]);

/** How many scene units of slide one millimetre between the slits takes, so the slits visibly part. */
const PARTING = 0.1;

/** A measure along the front of the bench from the slits to the screen: the distance the fringes spread over. */
function Throw({ long }: { readonly long: number }) {
  return (
    <group position={[SLITS_AT, 0.02, 0.42]}>
      {Arr.map(
        [
          { at: long / 2, key: "span", size: [long, 0.012, 0.012] },
          { at: 0, key: "slits", size: [0.012, 0.012, 0.12] },
          { at: long, key: "screen", size: [0.012, 0.012, 0.12] },
        ] as const,
        (bar) => (
          <mesh key={bar.key} position={[bar.at, 0, 0]}>
            <boxGeometry args={bar.size} />
            <meshBasicMaterial color={PLOT_COLORS.teal} toneMapped={false} />
          </mesh>
        )
      )}
    </group>
  );
}

/**
 * Young's double slit on an optical bench: a laser lights two slits in a
 * slide, and the light that spreads from them overlaps on a screen in
 * bright and dark fringes. The screen stands at the lab's distance along
 * the rail's scale, and shows the fringes in close-up over a printed
 * millimetre scale, with a dot over every bright fringe counted in a span.
 * The view faces the screen and holds its whole face, with room under it
 * for the slits and the laser's aperture, which stand nearer and so show
 * lower, so the fringes and their scale fill the frame at any distance.
 */
export function SlitScene({
  distance,
  separation,
  spacing,
  span,
}: {
  /** The distance from the slits to the screen, in metres. */
  readonly distance: number;
  /** The slit separation, in millimetres. */
  readonly separation: number;
  /** The fringe spacing on the screen, in millimetres. */
  readonly spacing: number;
  /** A distance along the screen, in millimetres, whose bright fringes are counted. */
  readonly span: number | undefined;
}) {
  const format = usePrintNumber();
  const long = distance * 100 * UNIT;
  const sheet = useMemo(
    () => ({
      height: CARD.tall,
      marks: screenMarks(
        span === undefined ? { spacing } : { span, spacing },
        PRINT,
        { count: PLOT_COLORS.amber, scale: INSTRUMENT_COLORS.graphite },
        format
      ),
      width: CARD.wide,
    }),
    [format, spacing, span]
  );

  return (
    <View
      box={{
        x: { max: SLITS_AT + long + 0.02, min: SLITS_AT + long - 0.02 },
        y: {
          max: AXIS + CARD.tall / 2 + 0.06,
          min: Math.min(0.15, AXIS - FALL * (long + THROW)),
        },
        z: { max: CARD.wide / 2 + 0.06, min: -CARD.wide / 2 - 0.06 },
      }}
      from={FROM}
    >
      <SeamlessBenchSurface />
      <Backboard back={1.6} tall={2.5} wide={LENGTH + 0.7} />
      <Rail length={LENGTH} unit={UNIT} />
      <Rider at={SLITS_AT - THROW - 0.31} drop={LASER_DROP} height={AXIS}>
        <group position={[0.31, 0, 0]}>
          <Laser color={INSTRUMENT_COLORS.laserBeam} />
        </group>
      </Rider>
      <Rider at={SLITS_AT} drop={SLIDE_DROP} height={AXIS}>
        <Slits color={INSTRUMENT_COLORS.laserBeam} gap={separation * PARTING} />
      </Rider>
      <Rider at={SLITS_AT + long} drop={CARD.tall / 2 + 0.02} height={AXIS}>
        <Screen tall={CARD.tall} wide={CARD.wide}>
          <group position={[0, 0, 0.001]}>
            <PrintFace sheet={sheet} stock="ink" />
          </group>
          <group position={[0, BAND.at, 0.002]}>
            <Fringes
              color={INSTRUMENT_COLORS.laserBeam}
              spacing={spacing / (SCREEN_HALF * 2)}
              start={fringeStart(spacing, span) / (SCREEN_HALF * 2)}
              tall={BAND.tall}
              wide={BAND.wide}
            />
          </group>
        </Screen>
      </Rider>
      <Beam
        color={INSTRUMENT_COLORS.laserBeam}
        points={[
          [SLITS_AT - THROW, AXIS, 0],
          [SLITS_AT, AXIS, 0],
        ]}
        strength={0.95}
        width={0.01}
      />
      <group position={[SLITS_AT, AXIS, 0]}>
        <Spread
          color={INSTRUMENT_COLORS.laserBeam}
          long={long - 0.01}
          wide={BAND.wide}
        />
      </group>
      <Throw long={long} />
    </View>
  );
}
