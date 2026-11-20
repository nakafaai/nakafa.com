import { Line } from "@react-three/drei";
import {
  graphSpot,
  INK,
  letterSide,
  pointAt,
  type Sheet,
  type Tops,
} from "@repo/design-system/components/contents/mathematics/journey/layout";
import { Print } from "@repo/design-system/components/contents/mathematics/journey/paper";
import {
  type Units,
  unitTex,
} from "@repo/design-system/components/contents/mathematics/journey/readout";
import {
  cornerName,
  lengthOf,
  motionOf,
  type Stage,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { JOURNEY_COLORS } from "@repo/design-system/lib/material/journey";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

/**
 * How far a corner's letter stands from its corner, and a guide's words from
 * the guide, in metres. A run's minutes stand further off, clear of the
 * letters at either end of it, as a short run is narrower than its words.
 */
const LETTER_OFF = 0.024;
const GUIDE_OFF = 0.012;
const RUN_OFF = 0.036;

/** The dashes of the guides: how long each dash and each gap is, in metres. */
const DASHES = { dash: 0.009, gap: 0.006 } as const;

/**
 * The letters of the bus's corners after O: A where its first leg ends, B
 * where its second ends, and on, each set outside the bend of the line.
 */
export function Corners({
  sheet,
  stages,
  tops,
}: {
  readonly sheet: Sheet;
  readonly stages: Arr.NonEmptyReadonlyArray<Stage>;
  readonly tops: Tops;
}) {
  const corners = [
    graphSpot(
      sheet,
      tops,
      Arr.headNonEmpty(stages).start,
      Arr.headNonEmpty(stages).from
    ),
    ...Arr.map(stages, (stage) => graphSpot(sheet, tops, stage.end, stage.to)),
  ];
  return (
    <group>
      {Arr.map(Arr.drop(corners, 1), (here, index) => {
        const side = letterSide(
          sheet,
          here,
          Arr.get(corners, index),
          Arr.get(corners, index + 2)
        );
        return (
          <Print
            key={cornerName(index + 1)}
            x={here.x + side.x * LETTER_OFF}
            z={here.z + side.z * LETTER_OFF}
          >
            <InlineMath math={cornerName(index + 1)} />
          </Print>
        );
      })}
    </group>
  );
}

/**
 * How far back the minutes of a leg's run stand from the run: under it, as
 * a teacher writes them under a triangle's foot, unless the leg lies over
 * the run, as when it heads back or stands still, or the run lies on the time
 * axis, whose numbers fill the space under it. There they stand inside the
 * triangle, in its right angle, where it is widest.
 */
function runOffset(stage: Stage) {
  if (motionOf(stage) !== "away") {
    return -RUN_OFF;
  }
  return onTimeAxis(stage) ? -GUIDE_OFF : RUN_OFF;
}

/** Whether a leg sets out from the start, so its run lies on the time axis. */
function onTimeAxis(stage: Stage) {
  return motionOf(stage) === "away" && stage.from === 0;
}

/**
 * The rise and the run of the leg in focus, dashed: the run across under the
 * leg, or over it when the leg heads back or stands still, marked with the
 * minutes it takes, and the rise up or down to the leg's end, marked with the
 * kilometres it covers. A stop has no rise, as it covers none.
 */
export function SlopeGuides({
  sheet,
  stage,
  tops,
  units,
}: {
  readonly sheet: Sheet;
  readonly stage: Stage;
  readonly tops: Tops;
  readonly units: Units;
}) {
  const quantity = useQuantity();
  const start = graphSpot(sheet, tops, stage.start, stage.from);
  const corner = graphSpot(sheet, tops, stage.end, stage.from);
  const end = graphSpot(sheet, tops, stage.end, stage.to);
  const off = runOffset(stage);
  return (
    <group>
      <Line
        color={JOURNEY_COLORS.slope}
        dashed
        dashSize={DASHES.dash}
        gapSize={DASHES.gap}
        lineWidth={1.6}
        points={[
          pointAt(start, INK.guide),
          pointAt(corner, INK.guide),
          pointAt(end, INK.guide),
        ]}
      />
      <Print
        anchorX={onTimeAxis(stage) ? "right" : "center"}
        anchorY={off < 0 ? "bottom" : "top"}
        color={JOURNEY_COLORS.slope}
        x={onTimeAxis(stage) ? corner.x - GUIDE_OFF : (start.x + corner.x) / 2}
        z={corner.z + off}
      >
        <InlineMath
          math={quantity(stage.end - stage.start, unitTex(units.time), 1)}
        />
      </Print>
      {motionOf(stage) === "still" ? null : (
        <Print
          anchorX="left"
          color={JOURNEY_COLORS.slope}
          x={corner.x + GUIDE_OFF}
          z={(corner.z + end.z) / 2}
        >
          <InlineMath
            math={quantity(lengthOf(stage), unitTex(units.distance), 1)}
          />
        </Print>
      )}
    </group>
  );
}

/**
 * Where two travellers meet: a ring round the crossing of their lines, and
 * dashed guides from it down to the time axis and across to the distance
 * axis, where the learner reads when and where they meet.
 */
export function MeetingMark({
  meeting,
  sheet,
  tops,
}: {
  readonly meeting: { readonly distance: number; readonly minute: number };
  readonly sheet: Sheet;
  readonly tops: Tops;
}) {
  const at = graphSpot(sheet, tops, meeting.minute, meeting.distance);
  const floor = graphSpot(sheet, tops, meeting.minute, 0);
  const wall = graphSpot(sheet, tops, 0, meeting.distance);
  return (
    <group>
      <Line
        color={JOURNEY_COLORS.meeting}
        dashed
        dashSize={DASHES.dash}
        gapSize={DASHES.gap}
        lineWidth={1.6}
        points={[
          pointAt(floor, INK.guide),
          pointAt(at, INK.guide),
          pointAt(wall, INK.guide),
        ]}
      />
      <mesh position={pointAt(at, INK.dot)} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.0105, 0.0135, 40]} />
        <meshBasicMaterial
          color={JOURNEY_COLORS.meeting}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
