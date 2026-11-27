import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type {
  Hue,
  Titration,
} from "@repo/design-system/components/contents/chemistry/titration/model";
import { hueAfter } from "@repo/design-system/components/contents/chemistry/titration/model";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Burette } from "@repo/design-system/components/three/apparatus/burette";
import {
  STAND_TOP,
  Stand,
} from "@repo/design-system/components/three/apparatus/stand";
import {
  BURETTE,
  meniscusOf,
} from "@repo/design-system/components/three/apparatus/tube";
import { Vessel } from "@repo/design-system/components/three/apparatus/vessel";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
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

/** The white tile on the stand's base that the flask stands on, so its colour reads against white. */
const TILE_HEIGHT = 0.006;

/**
 * What the camera frames, in metres: the stand's base, the tile and the
 * flask at the foot, the burette to its open top, and the room its reading
 * takes beside it. The burette is as tall as the frame, so its scale and its
 * meniscus are as large as a 50 cm³ burette can be drawn whole.
 */
const FRAME = {
  x: { max: 0.25, min: -0.15 },
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
 * 250 mL conical flask on a white tile. The burette's level falls by what has
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
          <mesh
            castShadow
            position={[0, STAND_TOP + TILE_HEIGHT / 2, 0]}
            receiveShadow
          >
            <boxGeometry args={[0.11, TILE_HEIGHT, 0.11]} />
            <SurfaceMaterial
              coat={0.7}
              color={BENCH_COLORS.ceramicTile}
              repeat={[2, 2]}
              roughness={0.4}
              surface="ceramic"
            />
          </mesh>
          <group position={[0, STAND_TOP + TILE_HEIGHT, 0]}>
            <Vessel
              capacity={250}
              holds={{
                color: hueColor(hue, titration),
                strength:
                  hue === "colourless" ? STRENGTH.clear : STRENGTH.tinted,
                volume: titration.analyte.volume + added,
              }}
              kind="conical"
            />
          </group>
          <group position={[0, TIP_END, 0]}>
            <Burette
              holds={{
                color: dichromate
                  ? REAGENT_COLORS.dichromate
                  : REAGENT_COLORS.solution,
                strength: dichromate ? STRENGTH.dichromate : STRENGTH.clear,
              }}
              reading={added}
            />
          </group>
          {showReading ? (
            <ThreeLabel
              anchorX="left"
              color={ORIGIN_COLOR.LIGHT}
              fontSize="compact"
              gap={0.004}
              outlineColor={ORIGIN_COLOR.DARK}
              outlineWidth={0.006}
              position={[
                BURETTE.radius + 0.012,
                TIP_END + meniscusOf(added),
                0,
              ]}
            >
              <InlineMath
                math={`\\leftarrow ${String(Math.round(added * 10) / 10)}\\text{ cm}^3`}
              />
            </ThreeLabel>
          ) : null}
        </group>
      </CameraBounds>
    </group>
  );
}
