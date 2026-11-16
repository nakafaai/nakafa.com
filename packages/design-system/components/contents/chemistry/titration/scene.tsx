import {
  ColumnLiquid,
  Flask,
  FlaskLiquid,
  flaskRadiusAt,
  LabBench,
} from "@repo/design-system/components/contents/chemistry/bench";
import {
  type Hue,
  hueAfter,
  levelFor,
  type Titration,
} from "@repo/design-system/components/contents/chemistry/titration/model";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  GlassMaterial,
  MetalMaterial,
} from "@repo/design-system/components/three/physical";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";

/** The burette's capacity in cm³. */
export const BURETTE_CAPACITY = 50;

/** Where the flask and the burette above it stand, in metres from the bench's middle. */
const AXIS_Z = 0.05;

/** The burette's zero mark and its 50 cm³ mark, in metres above the bench. */
const ZERO_MARK = 0.74;
const FULL_MARK = 0.29;

/** The burette tube's outer radius, the tip's end, and the stopcock's height. */
const TUBE_RADIUS = 0.0065;
const TIP_END = 0.165;
const STOPCOCK = 0.21;
const TUBE_TOP = 0.79;

/** Where the stand's rod rises, behind and to the left of the burette. */
const ROD_X = -0.11;
const ROD_Z = -0.04;

/** The neck height of the conical flask, which its liquid never passes. */
const FLASK_NECK = 0.105;

/** The tile the flask stands on, so its colour reads against white. */
const TILE_HEIGHT = 0.006;

/** The colour each hue draws with, from the real reagents. */
function hueColor(hue: Hue, titration: Titration) {
  const colors = {
    colourless: MATERIAL.solution,
    green: MATERIAL.chromiumGreen,
    orange:
      titration.titrant.solute === "potassium-dichromate"
        ? MATERIAL.dichromate
        : MATERIAL.methylOrange,
    "pale-green": MATERIAL.ironPaleGreen,
    pink: MATERIAL.phenolphthaleinPink,
    red: MATERIAL.methylRed,
    yellow: MATERIAL.methylYellow,
  } satisfies Record<Hue, string>;
  return colors[hue];
}

/** The height of the burette's meniscus once `added` cm³ have run out. */
function meniscusAt(added: number) {
  return ZERO_MARK - (added / BURETTE_CAPACITY) * (ZERO_MARK - FULL_MARK);
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
  const level = levelFor(
    titration.analyte.volume + added,
    flaskRadiusAt,
    FLASK_NECK
  );
  const titrantColor =
    titration.titrant.solute === "potassium-dichromate"
      ? MATERIAL.dichromate
      : MATERIAL.solution;
  const meniscus = meniscusAt(added);

  return (
    <group>
      <LabBench width={3} />
      <Stand />
      <group position={[0, 0, AXIS_Z]}>
        <mesh position={[0, TILE_HEIGHT / 2, 0]} receiveShadow>
          <boxGeometry args={[0.16, TILE_HEIGHT, 0.16]} />
          <meshStandardMaterial color={MATERIAL.ceramicTile} roughness={0.4} />
        </mesh>
        <group position={[0, TILE_HEIGHT, 0]}>
          <Flask />
          <FlaskLiquid
            color={hueColor(hue, titration)}
            level={level}
            opacity={hue === "colourless" ? 0.3 : 0.78}
          />
        </group>
        <Burette color={titrantColor} meniscus={meniscus} />
        {showReading ? (
          <ThreeLabel
            anchorX="left"
            color={ORIGIN_COLOR.LIGHT}
            fontSize="compact"
            gap={0.004}
            outlineColor={ORIGIN_COLOR.DARK}
            outlineWidth={0.006}
            position={[TUBE_RADIUS + 0.012, meniscus, 0]}
          >
            <InlineMath
              math={`\\leftarrow ${String(Math.round(added * 10) / 10)}\\text{ cm}^3`}
            />
          </ThreeLabel>
        ) : null}
      </group>
    </group>
  );
}

/**
 * A 50 cm³ burette as ISO 385 makes it: a borosilicate tube with its scale,
 * the white Schellbach stripe and its blue centre line behind it, which make
 * the meniscus easy to read, the titrant up to that meniscus, a PTFE
 * stopcock key with its paddle, and a drawn-out tip.
 */
function Burette({
  color,
  meniscus,
}: {
  readonly color: string;
  readonly meniscus: number;
}) {
  const tube = TUBE_TOP - STOPCOCK;
  const marks = Arr.makeBy(BURETTE_CAPACITY / 5 + 1, (index) => index * 5);

  return (
    <group>
      <mesh position={[0, STOPCOCK + tube / 2, 0]}>
        <cylinderGeometry
          args={[TUBE_RADIUS, TUBE_RADIUS, tube, 32, 1, true]}
        />
        <GlassMaterial color={MATERIAL.glass} />
      </mesh>
      <mesh position={[0, STOPCOCK + tube / 2, -TUBE_RADIUS - 0.0004]}>
        <planeGeometry args={[TUBE_RADIUS * 1.2, tube]} />
        <meshStandardMaterial
          color={MATERIAL.schellbachWhite}
          roughness={0.8}
        />
      </mesh>
      <mesh position={[0, STOPCOCK + tube / 2, -TUBE_RADIUS - 0.0003]}>
        <planeGeometry args={[TUBE_RADIUS * 0.25, tube]} />
        <meshStandardMaterial color={MATERIAL.schellbachBlue} roughness={0.6} />
      </mesh>
      <ColumnLiquid
        bottom={STOPCOCK}
        color={color}
        level={meniscus}
        opacity={0.6}
        radius={TUBE_RADIUS - 0.001}
      />
      {Arr.map(marks, (volume) => (
        <mesh
          key={volume}
          position={[0, meniscusAt(volume), TUBE_RADIUS + 0.0002]}
        >
          <boxGeometry
            args={[volume % 10 === 0 ? 0.008 : 0.005, 0.0008, 0.0004]}
          />
          <meshBasicMaterial color={MATERIAL.graphite} />
        </mesh>
      ))}
      <mesh position={[0, (TIP_END + STOPCOCK) / 2, 0]}>
        <cylinderGeometry
          args={[TUBE_RADIUS * 0.6, 0.0016, STOPCOCK - TIP_END, 16]}
        />
        <GlassMaterial color={MATERIAL.glass} />
      </mesh>
      <mesh position={[0, STOPCOCK, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0045, 0.0035, 0.026, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={MATERIAL.ptfe}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[0.016, STOPCOCK, 0]}>
        <boxGeometry args={[0.004, 0.016, 0.003]} />
        <meshPhysicalMaterial
          clearcoat={0.3}
          color={MATERIAL.ptfe}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

/** A retort stand: a cast-iron base, a chrome rod, and a clamp holding the burette. */
function Stand() {
  const clampY = 0.62;
  const reach = Math.hypot(ROD_X, AXIS_Z - ROD_Z);
  return (
    <group>
      <mesh
        castShadow
        position={[ROD_X + 0.02, 0.006, ROD_Z + 0.04]}
        receiveShadow
      >
        <boxGeometry args={[0.13, 0.012, 0.2]} />
        <MetalMaterial color={MATERIAL.castIron} roughness={0.65} />
      </mesh>
      <mesh castShadow position={[ROD_X, 0.45, ROD_Z]}>
        <cylinderGeometry args={[0.006, 0.006, 0.9, 16]} />
        <MetalMaterial color={MATERIAL.chrome} roughness={0.22} />
      </mesh>
      <mesh
        castShadow
        position={[ROD_X / 2, clampY, (ROD_Z + AXIS_Z) / 2]}
        rotation={[0, Math.atan2(AXIS_Z - ROD_Z, -ROD_X), Math.PI / 2]}
      >
        <cylinderGeometry args={[0.004, 0.004, reach, 12]} />
        <MetalMaterial color={MATERIAL.chrome} roughness={0.22} />
      </mesh>
      <mesh position={[0, clampY, AXIS_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TUBE_RADIUS + 0.003, 0.003, 10, 32]} />
        <MetalMaterial color={MATERIAL.castIron} roughness={0.45} />
      </mesh>
    </group>
  );
}
