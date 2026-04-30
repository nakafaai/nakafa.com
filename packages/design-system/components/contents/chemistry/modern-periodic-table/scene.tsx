import { Billboard, Line, Text } from "@react-three/drei";
import {
  GROUP_ONE_FOCUS_ID,
  getModernPeriodicTableCategoryColor,
  INNER_TRANSITION_FOCUS_ID,
  MAIN_PERIODIC_TABLE_ROWS,
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
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import {
  MONO_FONT_PATH,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";

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
const SERIES_LANTHANIDE_Z = 2.22;
const SERIES_ACTINIDE_Z = 2.76;
const PERIOD_AXIS_LABEL_OFFSET = TILE_GAP * 2.8;
const TILE_LABEL_Y_OFFSET = 0.16;
const TILE_LABEL_RENDER_ORDER = 10;
const TILE_LABEL_OUTLINE_WIDTH = 0.018;

const TRANSITION_LABEL_SYMBOLS = ["Sc", "Fe", "Cu", "Ag", "Au", "Hg"];
const INNER_TRANSITION_LABEL_SYMBOLS = ["La", "Lu", "Ac", "Lr"];
const ALWAYS_VISIBLE_SYMBOLS = ["H", "He", "Na", "Mg", "Si", "Cl", "Ar"];

/**
 * Renders the 3D periodic-table map and highlights the active reading focus.
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
  return (
    <group>
      <GuideLabels colors={colors} labels={labels} />
      <GuideLines colors={colors} focusId={focusId} />

      {MAIN_PERIODIC_TABLE_ROWS.map((row) =>
        row.entries.map((entry) => (
          <MainTableTile
            colors={colors}
            entry={entry}
            focusId={focusId}
            key={`${row.period}-${entry.symbol}`}
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
 * Places the main axis labels so the map can be read without dragging first.
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
      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize={THREE_FONT_SIZE.diagram}
        position={[0, 0.62, MAIN_LABEL_Z - 0.34]}
      >
        {`${labels.group} 1-18`}
      </SceneLabel>

      <SceneLabel
        alwaysOnTop
        color={colors.text}
        fontSize={THREE_FONT_SIZE.reading}
        position={[getMainX(1) - PERIOD_AXIS_LABEL_OFFSET, 0.42, 0]}
      >
        {`${labels.period} 1-7`}
      </SceneLabel>

      {PERIODIC_SERIES_ROWS.map((row, rowIndex) => (
        <SceneLabel
          alwaysOnTop
          color={colors.text}
          fontSize={THREE_FONT_SIZE.reading}
          key={row.key}
          position={[-4.08, 0.32, getSeriesZ(rowIndex)]}
        >
          {labels.seriesNames[row.key]}
        </SceneLabel>
      ))}
    </>
  );
}

/**
 * Draws subtle reading rails for the active row or column.
 */
function GuideLines({
  colors,
  focusId,
}: {
  colors: ModernPeriodicTableSceneColors;
  focusId: ModernPeriodicTableFocusId;
}) {
  if (focusId === PERIOD_THREE_FOCUS_ID) {
    const z = getMainZ(3);

    return (
      <Line
        color={colors.activeStroke}
        lineWidth={4}
        points={[
          [getMainX(1), 0.08, z],
          [getMainX(18), 0.08, z],
        ]}
      />
    );
  }

  if (focusId === INNER_TRANSITION_FOCUS_ID) {
    return (
      <Line
        color={colors.activeStroke}
        lineWidth={4}
        points={[
          [getSeriesX(0), 0.08, SERIES_LANTHANIDE_Z],
          [getSeriesX(14), 0.08, SERIES_ACTINIDE_Z],
        ]}
      />
    );
  }

  const group = getFocusedGroup(focusId);

  if (group === 0) {
    return null;
  }

  const x = getMainX(group);

  return (
    <Line
      color={colors.activeStroke}
      lineWidth={4}
      points={[
        [x, 0.08, getMainZ(1)],
        [x, 0.08, getMainZ(7)],
      ]}
    />
  );
}

/**
 * Resolves the highlighted column when a focus maps to one clear group.
 */
function getFocusedGroup(focusId: ModernPeriodicTableFocusId) {
  if (focusId === GROUP_ONE_FOCUS_ID) {
    return 1;
  }

  if (focusId === NOBLE_GAS_FOCUS_ID) {
    return 18;
  }

  return 0;
}

/**
 * Renders one tile in the main table.
 */
function MainTableTile({
  colors,
  entry,
  focusId,
  period,
}: {
  colors: ModernPeriodicTableSceneColors;
  entry: PeriodicElementEntry;
  focusId: ModernPeriodicTableFocusId;
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
      label={getMainTileLabel(entry, focusId, highlighted)}
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
          {label}
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
  children: string;
  color: string;
  fontSize: number;
  outlineColor: string;
  position: readonly [number, number, number];
}) {
  return (
    <Billboard position={position}>
      <Text
        anchorX="center"
        anchorY="middle"
        color={color}
        font={MONO_FONT_PATH}
        fontSize={fontSize}
        outlineColor={outlineColor}
        outlineWidth={TILE_LABEL_OUTLINE_WIDTH}
        renderOrder={TILE_LABEL_RENDER_ORDER}
      >
        {children}
        <meshBasicMaterial color={color} depthTest={false} toneMapped={false} />
      </Text>
    </Billboard>
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
  highlighted: boolean
) {
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
