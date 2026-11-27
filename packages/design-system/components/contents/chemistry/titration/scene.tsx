import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type {
  Hue,
  Titration,
} from "@repo/design-system/components/contents/chemistry/titration/model";
import { hueAfter } from "@repo/design-system/components/contents/chemistry/titration/model";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Burette } from "@repo/design-system/components/three/apparatus/burette";
import { Inset } from "@repo/design-system/components/three/apparatus/inset";
import { ReaderCard } from "@repo/design-system/components/three/apparatus/reader";
import {
  STAND_TOP,
  Stand,
} from "@repo/design-system/components/three/apparatus/stand";
import {
  TILE_HEIGHT,
  Tile,
} from "@repo/design-system/components/three/apparatus/tile";
import {
  BURETTE,
  meniscusOf,
} from "@repo/design-system/components/three/apparatus/tube";
import { Vessel } from "@repo/design-system/components/three/apparatus/vessel";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";

/** The burette's capacity in cm³. */
export const BURETTE_CAPACITY = BURETTE.capacity;

/** Where the flask and the burette above it stand, in metres from the bench's middle. */
const AXIS_Z = 0.05;

/** How high the end of the burette's tip hangs above the bench, just inside the flask's mouth. */
const TIP_END = 0.154;

/** Where the stand's rod rises, behind and to the left of the burette, how tall it is, and where its clamp grips. */
const ROD = [-0.11, -0.04] as const;
const ROD_HEIGHT = 0.72;
const GRIP = 0.62;

/**
 * The two close views beside the apparatus, in metres: the meniscus against
 * a reader card above, where the burette is read, and the liquid in the
 * flask below, where the colour changes. Each picture is `size` across and
 * shows `span` of its subject.
 */
const VIEWS = {
  flask: { at: [0.25, 0.2, 0] as const, span: 0.11 },
  reading: { at: [0.25, 0.58, 0] as const, span: 0.03 },
  size: 0.2,
} as const;

/** How far under its close view the reading is written. */
const CAPTION = 0.115;

/**
 * What the camera frames, in metres: the stand's base, the tile and the
 * flask at the foot, the whole burette to its open top, and the two close
 * views beside it with the reading under the upper one.
 */
const FRAME = {
  x: { max: VIEWS.reading.at[0] + VIEWS.size / 2 + 0.012, min: -0.15 },
  y: { max: TIP_END + BURETTE.top + 0.005, min: -0.02 },
  z: { max: AXIS_Z + 0.02, min: AXIS_Z - 0.02 },
};

/** How strongly the solutions absorb light, for each metre: a clear one, an indicator's colour, and dichromate. */
const STRENGTH = { clear: 3, dichromate: 110, tinted: 30 } as const;

/** The colour each hue draws with, from the real reagents. */
function hueColor(hue: Hue, titration: Titration) {
  const colors = {
    colourless: REAGENT_COLORS.solution,
    green: REAGENT_COLORS.chromiumGreen,
    orange:
      titration.titrant.solute === "potassium-dichromate"
        ? REAGENT_COLORS.dichromate
        : REAGENT_COLORS.methylOrange,
    "pale-green": REAGENT_COLORS.ironPaleGreen,
    pink: REAGENT_COLORS.phenolphthaleinPink,
    red: REAGENT_COLORS.methylRed,
    yellow: REAGENT_COLORS.methylYellow,
  } satisfies Record<Hue, string>;
  return colors[hue];
}

/**
 * A titration at bench scale: a retort stand clamping a 50 cm³ burette over a
 * 250 mL conical flask on a white tile, with a reader card behind the
 * meniscus. Two close views beside it show the meniscus against the card,
 * where the burette is read, and the liquid in the flask, where the colour
 * changes, with the reading written under the first. The burette's level falls by what has
 * run out, and the flask fills by the same volume and takes the colour its
 * indicator, or the dichromate itself, shows at that point.
 */
export function TitrationScene({
  added,
  showReading,
  titration,
}: {
  readonly added: number;
  readonly showReading: boolean;
  readonly titration: Titration;
}) {
  const hue = hueAfter(titration, added);
  const dichromate = titration.titrant.solute === "potassium-dichromate";
  const meniscus = TIP_END + meniscusOf(added);
  const liquid = {
    color: hueColor(hue, titration),
    strength: hue === "colourless" ? STRENGTH.clear : STRENGTH.tinted,
    volume: titration.analyte.volume + added,
  };
  const titrant = {
    color: dichromate ? REAGENT_COLORS.dichromate : REAGENT_COLORS.solution,
    strength: dichromate ? STRENGTH.dichromate : STRENGTH.clear,
  };

  return (
    <group>
      <CameraBounds exclude>
        <LabBench width={3} />
      </CameraBounds>
      <CameraBounds bounds={FRAME}>
        <Stand
          at={ROD}
          height={ROD_HEIGHT}
          holds={[{ at: [0, GRIP, AXIS_Z], radius: BURETTE.radius }]}
        />
        <group position={[0, 0, AXIS_Z]}>
          <Flask liquid={liquid} />
          <Column added={added} titrant={titrant} />
          <ReaderCard meniscus={meniscus} radius={BURETTE.radius} />
          <Inset
            at={VIEWS.reading.at}
            look={[0, meniscus, 0]}
            size={VIEWS.size}
            span={VIEWS.reading.span}
          >
            <Column added={added} titrant={titrant} />
            <ReaderCard meniscus={meniscus} radius={BURETTE.radius} />
          </Inset>
          <Inset
            at={VIEWS.flask.at}
            look={[0, STAND_TOP + VIEWS.flask.span * 0.42, 0]}
            size={VIEWS.size}
            span={VIEWS.flask.span}
          >
            <Flask liquid={liquid} />
          </Inset>
          {showReading ? (
            <ThreeLabel
              anchorY="top"
              color={ORIGIN_COLOR.LIGHT}
              fontSize="compact"
              outlineColor={ORIGIN_COLOR.DARK}
              outlineWidth={0.006}
              position={[VIEWS.reading.at[0], VIEWS.reading.at[1] - CAPTION, 0]}
            >
              <InlineMath
                math={`${String(Math.round(added * 10) / 10)}\\text{ cm}^3`}
              />
            </ThreeLabel>
          ) : null}
        </group>
      </CameraBounds>
    </group>
  );
}

/** The flask on its white tile on the stand's base, holding the analyte and what has run into it. */
function Flask({
  liquid,
}: {
  readonly liquid: {
    readonly color: string;
    readonly strength: number;
    readonly volume: number;
  };
}) {
  return (
    <group>
      <group position={[0, STAND_TOP, 0]}>
        <Tile side={0.11} />
      </group>
      <group position={[0, STAND_TOP + TILE_HEIGHT, 0]}>
        <Vessel capacity={250} holds={liquid} kind="conical" />
      </group>
    </group>
  );
}

/** The burette over the flask, its meniscus at what has run out. */
function Column({
  added,
  titrant,
}: {
  readonly added: number;
  readonly titrant: { readonly color: string; readonly strength: number };
}) {
  return (
    <group position={[0, TIP_END, 0]}>
      <Burette holds={titrant} reading={added} />
    </group>
  );
}
