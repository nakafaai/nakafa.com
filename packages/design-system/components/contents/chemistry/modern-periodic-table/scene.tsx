import { useThree } from "@react-three/fiber";
import {
  GROUP_ONE_FOCUS_ID,
  getModernPeriodicTableCategoryColor,
  INNER_TRANSITION_FOCUS_ID,
  MAIN_PERIODIC_TABLE_ROWS,
  METALLOID_FOCUS_ID,
  MODERN_PERIODIC_TABLE_FOCI,
  type ModernPeriodicTableFocusId,
  type ModernPeriodicTableLabLabels,
  type ModernPeriodicTableSceneColors,
  NOBLE_GAS_FOCUS_ID,
  PERIOD_THREE_FOCUS_ID,
  PERIODIC_SERIES_ROWS,
  type PeriodicElementEntry,
  SERIES_MARKER_CATEGORY_ID,
  TRANSITION_FOCUS_ID,
} from "@repo/design-system/components/contents/chemistry/modern-periodic-table/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { THREE_FONT_SIZE } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene-frame";
import type { ReactNode } from "react";

const GROUP_COUNT = 18;
const PERIOD_COUNT = 7;
const GROUP_CENTER = (GROUP_COUNT + 1) / 2;
const PERIOD_CENTER = (PERIOD_COUNT + 1) / 2;
const TILE_WIDTH = 0.42;
const TILE_DEPTH = 0.42;
const TILE_GAP = 0.48;
const INACTIVE_TILE_HEIGHT = 0.08;
const ACTIVE_TILE_HEIGHT = 0.34;
const MAIN_LABEL_Z = -2.35;
const SERIES_START_GROUP = 4;
const SERIES_LANTHANIDE_Z = 2.4;
const SERIES_ACTINIDE_Z = 3.65;
const PERIOD_AXIS_LABEL_OFFSET = TILE_GAP * 1.3;
const TILE_LABEL_Y_OFFSET = 0.16;
const TILE_LABEL_OUTLINE_WIDTH = 0.018;

const TRANSITION_LABEL_SYMBOLS = ["Sc", "Fe", "Cu", "Ag", "Au", "Hg"];
const INNER_TRANSITION_LABEL_SYMBOLS = ["La", "Lu", "Ac", "Lr"];
const ALWAYS_VISIBLE_SYMBOLS = ["H", "He", "Na", "Mg", "Si", "Cl", "Ar"];
// The highlighted tiles still show the full group. These spaced examples keep
// its direction and membership readable when the entire table is narrow.
const NARROW_LABEL_SYMBOLS = {
  [GROUP_ONE_FOCUS_ID]: ["H", "Na", "Cs"],
  [PERIOD_THREE_FOCUS_ID]: ["Na", "Al", "S", "Ar"],
  [TRANSITION_FOCUS_ID]: ["Sc", "Fe", "Cu", "Au"],
  [INNER_TRANSITION_FOCUS_ID]: [],
  [METALLOID_FOCUS_ID]: ["B", "Ge", "Te"],
  [NOBLE_GAS_FOCUS_ID]: ["He", "Ar", "Rn"],
} satisfies Record<ModernPeriodicTableFocusId, string[]>;

/**
 * Renders the 3D periodic-table model and highlights the active reading focus.
 */
export function ModernPeriodicTableScene({
  colors,
  focusId,
  labels,
}: {
  colors: ModernPeriodicTableSceneColors;
  focusId: ModernPeriodicTableFocusId;
  labels: ModernPeriodicTableLabLabels;
}) {
  const narrow = useThree((state) => isNarrowThreeScene(state.size, 1.15));

  return (
    <group>
      <GuideLabels colors={colors} labels={labels} />

      {MAIN_PERIODIC_TABLE_ROWS.map((row) =>
        row.entries.map((entry) => (
          <MainTableTile
            colors={colors}
            entry={entry}
            focusId={focusId}
            key={`${row.period}-${entry.symbol}`}
            narrow={narrow}
            period={row.period}
          />
        ))
      )}

      {PERIODIC_SERIES_ROWS.map((row, rowIndex) =>
        row.entries.map((entry, entryIndex) => (
          <SeriesTile
            colors={colors}
            entry={entry}
            entryIndex={entryIndex}
            focusId={focusId}
            key={`${row.key}-${entry.symbol}`}
            rowIndex={rowIndex}
          />
        ))
      )}
    </group>
  );
}

/**
 * Places the main axis labels so the model can be read without dragging first.
 */
function GuideLabels({
  colors,
  labels,
}: {
  colors: ModernPeriodicTableSceneColors;
  labels: ModernPeriodicTableLabLabels;
}) {
  return (
    <>
      <ThreeLabel
        color={colors.text}
        fontSize="diagram"
        position={[0, 0.62, MAIN_LABEL_Z - 0.34]}
      >
        {labels.group} 1–18
      </ThreeLabel>

      <ThreeLabel
        color={colors.text}
        fontSize="reading"
        position={[getMainX(1) - PERIOD_AXIS_LABEL_OFFSET, 0.42, 0]}
        rotation={-Math.PI / 2}
      >
        {labels.period} 1–7
      </ThreeLabel>

      {PERIODIC_SERIES_ROWS.map((row, rowIndex) => (
        <ThreeLabel
          color={colors.text}
          fontSize="reading"
          key={row.key}
          position={[0, 0.32, getSeriesZ(rowIndex) + 0.5]}
        >
          {labels.seriesNames[row.key]}
        </ThreeLabel>
      ))}
    </>
  );
}

/**
 * Renders one tile in the main table.
 */
function MainTableTile({
  colors,
  entry,
  focusId,
  narrow,
  period,
}: {
  colors: ModernPeriodicTableSceneColors;
  entry: PeriodicElementEntry;
  focusId: ModernPeriodicTableFocusId;
  narrow: boolean;
  period: number;
}) {
  const highlighted = isEntryHighlighted(entry, focusId);
  const height = highlighted ? ACTIVE_TILE_HEIGHT : INACTIVE_TILE_HEIGHT;
  const x = getMainX(entry.group);
  const z = getMainZ(period);

  return (
    <PeriodicTile
      color={getModernPeriodicTableCategoryColor(colors, entry.category)}
      colors={colors}
      height={height}
      highlighted={highlighted}
      label={getMainTileLabel(entry, focusId, highlighted, narrow)}
      position={[x, height / 2, z]}
    />
  );
}

/**
 * Renders one tile from the detached lanthanide or actinide row.
 */
function SeriesTile({
  colors,
  entry,
  entryIndex,
  focusId,
  rowIndex,
}: {
  colors: ModernPeriodicTableSceneColors;
  entry: (typeof PERIODIC_SERIES_ROWS)[number]["entries"][number];
  entryIndex: number;
  focusId: ModernPeriodicTableFocusId;
  rowIndex: number;
}) {
  const highlighted = focusId === INNER_TRANSITION_FOCUS_ID;
  const height = highlighted ? ACTIVE_TILE_HEIGHT : INACTIVE_TILE_HEIGHT;

  return (
    <PeriodicTile
      color={colors.innerTransition}
      colors={colors}
      height={height}
      highlighted={highlighted}
      label={getSeriesTileLabel(entry.symbol, highlighted)}
      position={[getSeriesX(entryIndex), height / 2, getSeriesZ(rowIndex)]}
    />
  );
}

/**
 * Draws a single periodic-table block with an optional readable label.
 */
function PeriodicTile({
  color,
  colors,
  height,
  highlighted,
  label,
  position,
}: {
  color: string;
  colors: ModernPeriodicTableSceneColors;
  height: number;
  highlighted: boolean;
  label: string;
  position: readonly [number, number, number];
}) {
  const opacity = highlighted ? 0.96 : 0.34;
  const labelColor = highlighted ? colors.tileText : colors.text;
  const labelOutlineColor = highlighted
    ? colors.tileTextOutline
    : colors.textOutline;
  const labelFontSize = highlighted
    ? THREE_FONT_SIZE.reading
    : THREE_FONT_SIZE.annotation;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[TILE_WIDTH, height, TILE_DEPTH]} />
        <meshStandardMaterial
          color={color}
          emissive={highlighted ? color : undefined}
          emissiveIntensity={highlighted ? 0.1 : 0}
          opacity={opacity}
          roughness={0.44}
          transparent
        />
      </mesh>

      {label && (
        <PeriodicTileLabel
          color={labelColor}
          fontSize={labelFontSize}
          outlineColor={labelOutlineColor}
          position={[0, height / 2 + TILE_LABEL_Y_OFFSET, 0]}
        >
          {label.includes("-") ? (
            label.replace("-", "–")
          ) : (
            <InlineMath math={`\\mathrm{${label}}`} />
          )}
        </PeriodicTileLabel>
      )}
    </group>
  );
}

/**
 * Keeps element symbols readable while the user orbits around raised tiles.
 */
function PeriodicTileLabel({
  children,
  color,
  fontSize,
  outlineColor,
  position,
}: {
  children: ReactNode;
  color: string;
  fontSize: number;
  outlineColor: string;
  position: readonly [number, number, number];
}) {
  return (
    <ThreeLabel
      color={color}
      fontSize={fontSize}
      maximumFontSize={16}
      minimumFontSize={10}
      outlineColor={outlineColor}
      outlineWidth={TILE_LABEL_OUTLINE_WIDTH}
      position={position}
    >
      {children}
    </ThreeLabel>
  );
}

/**
 * Calculates the horizontal position for a main-table group.
 */
function getMainX(group: number) {
  return (group - GROUP_CENTER) * TILE_GAP;
}

/**
 * Calculates the depth position for a main-table period.
 */
function getMainZ(period: number) {
  return (period - PERIOD_CENTER) * TILE_GAP;
}

/**
 * Calculates the horizontal position for an f-block entry.
 */
function getSeriesX(entryIndex: number) {
  return (SERIES_START_GROUP + entryIndex - GROUP_CENTER) * TILE_GAP;
}

/**
 * Calculates the depth position for the lanthanide or actinide row.
 */
function getSeriesZ(rowIndex: number) {
  return rowIndex === 0 ? SERIES_LANTHANIDE_Z : SERIES_ACTINIDE_Z;
}

/**
 * Checks whether one main-table entry belongs to the active focus.
 */
function isEntryHighlighted(
  entry: PeriodicElementEntry,
  focusId: ModernPeriodicTableFocusId
) {
  const focus = MODERN_PERIODIC_TABLE_FOCI[focusId];

  if (focus.symbols.some((symbol) => symbol === entry.symbol)) {
    return true;
  }

  return focus.categories.some((category) => category === entry.category);
}

/**
 * Chooses a readable label for main-table tiles without crowding the scene.
 */
function getMainTileLabel(
  entry: PeriodicElementEntry,
  focusId: ModernPeriodicTableFocusId,
  highlighted: boolean,
  narrow: boolean
) {
  if (narrow) {
    return NARROW_LABEL_SYMBOLS[focusId].some(
      (symbol) => symbol === entry.symbol
    )
      ? entry.symbol
      : "";
  }

  if (entry.category === SERIES_MARKER_CATEGORY_ID) {
    return highlighted ? entry.symbol : "";
  }

  if (focusId === TRANSITION_FOCUS_ID) {
    return TRANSITION_LABEL_SYMBOLS.some((symbol) => symbol === entry.symbol)
      ? entry.symbol
      : "";
  }

  if (focusId === INNER_TRANSITION_FOCUS_ID) {
    return "";
  }

  if (highlighted) {
    return entry.symbol;
  }

  return ALWAYS_VISIBLE_SYMBOLS.some((symbol) => symbol === entry.symbol)
    ? entry.symbol
    : "";
}

/**
 * Chooses a readable label for f-block tiles without making the row noisy.
 */
function getSeriesTileLabel(symbol: string, highlighted: boolean) {
  if (!highlighted) {
    return "";
  }

  return INNER_TRANSITION_LABEL_SYMBOLS.some(
    (labelSymbol) => labelSymbol === symbol
  )
    ? symbol
    : "";
}
