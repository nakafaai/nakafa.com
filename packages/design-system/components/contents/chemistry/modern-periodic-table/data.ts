import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import { getColor } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { Array as Arr, Result, Schema } from "effect";

export const GROUP_ONE_FOCUS_ID = "group-one";
export const PERIOD_THREE_FOCUS_ID = "period-three";
export const TRANSITION_FOCUS_ID = "transition";
export const INNER_TRANSITION_FOCUS_ID = "inner-transition";
export const METALLOID_FOCUS_ID = "metalloid";
export const NOBLE_GAS_FOCUS_ID = "noble-gas";

export type ModernPeriodicTableFocusId =
  | typeof GROUP_ONE_FOCUS_ID
  | typeof PERIOD_THREE_FOCUS_ID
  | typeof TRANSITION_FOCUS_ID
  | typeof INNER_TRANSITION_FOCUS_ID
  | typeof METALLOID_FOCUS_ID
  | typeof NOBLE_GAS_FOCUS_ID;

export const MODERN_PERIODIC_TABLE_FOCUS_IDS = [
  GROUP_ONE_FOCUS_ID,
  PERIOD_THREE_FOCUS_ID,
  TRANSITION_FOCUS_ID,
  INNER_TRANSITION_FOCUS_ID,
  METALLOID_FOCUS_ID,
  NOBLE_GAS_FOCUS_ID,
] satisfies ModernPeriodicTableFocusId[];

const METAL_CATEGORY_ID = "metal";
const TRANSITION_CATEGORY_ID = "transition-metal";
const METALLOID_CATEGORY_ID = "metalloid";
const NONMETAL_CATEGORY_ID = "nonmetal";
const NOBLE_GAS_CATEGORY_ID = "noble-gas";
const INNER_TRANSITION_CATEGORY_ID = "inner-transition";
export const SERIES_MARKER_CATEGORY_ID = "series-marker";

export const PERIODIC_ELEMENT_CATEGORY_IDS = [
  METAL_CATEGORY_ID,
  TRANSITION_CATEGORY_ID,
  METALLOID_CATEGORY_ID,
  NONMETAL_CATEGORY_ID,
  NOBLE_GAS_CATEGORY_ID,
  INNER_TRANSITION_CATEGORY_ID,
] as const;

const PeriodicElementCategoryIdSchema = Schema.Literals([
  ...PERIODIC_ELEMENT_CATEGORY_IDS,
  SERIES_MARKER_CATEGORY_ID,
]);
export type PeriodicElementCategoryId =
  typeof PeriodicElementCategoryIdSchema.Type;

const MODERN_PERIODIC_TABLE_CATEGORY_COLOR_KEYS = {
  [METAL_CATEGORY_ID]: "metal",
  [TRANSITION_CATEGORY_ID]: "transitionMetal",
  [METALLOID_CATEGORY_ID]: "metalloid",
  [NONMETAL_CATEGORY_ID]: "nonmetal",
  [NOBLE_GAS_CATEGORY_ID]: "nobleGas",
  [INNER_TRANSITION_CATEGORY_ID]: "innerTransition",
  [SERIES_MARKER_CATEGORY_ID]: "seriesMarker",
} satisfies Record<
  PeriodicElementCategoryId,
  keyof Pick<
    ReturnType<typeof getModernPeriodicTableSceneColors>,
    | "innerTransition"
    | "metal"
    | "metalloid"
    | "nobleGas"
    | "nonmetal"
    | "seriesMarker"
    | "transitionMetal"
  >
>;

const ElementCategoryGroupSchema = Schema.Struct({
  id: PeriodicElementCategoryIdSchema,
  symbols: Schema.String,
});

const ELEMENT_CATEGORY_GROUPS = [
  {
    id: METAL_CATEGORY_ID,
    symbols:
      "Li Be Na Mg Al K Ca Ga Rb Sr In Sn Cs Ba Tl Pb Bi Nh Fl Mc Lv Fr Ra",
  },
  {
    id: TRANSITION_CATEGORY_ID,
    symbols:
      "Sc Ti V Cr Mn Fe Co Ni Cu Zn Y Zr Nb Mo Tc Ru Rh Pd Ag Cd Hf Ta W Re Os Ir Pt Au Hg Rf Db Sg Bh Hs Mt Ds Rg Cn",
  },
  {
    id: METALLOID_CATEGORY_ID,
    symbols: "B Si Ge As Sb Te Po",
  },
  {
    id: NONMETAL_CATEGORY_ID,
    symbols: "H C N O F P S Cl Se Br I At Ts",
  },
  {
    id: NOBLE_GAS_CATEGORY_ID,
    symbols: "He Ne Ar Kr Xe Rn Og",
  },
  {
    id: INNER_TRANSITION_CATEGORY_ID,
    symbols:
      "La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr",
  },
  {
    id: SERIES_MARKER_CATEGORY_ID,
    symbols: "57-71 89-103",
  },
] satisfies (typeof ElementCategoryGroupSchema.Type)[];

const MAIN_PERIODIC_TABLE_SOURCE = [
  { period: 1, entries: "1:H:1 18:He:2" },
  {
    period: 2,
    entries: "1:Li:3 2:Be:4 13:B:5 14:C:6 15:N:7 16:O:8 17:F:9 18:Ne:10",
  },
  {
    period: 3,
    entries:
      "1:Na:11 2:Mg:12 13:Al:13 14:Si:14 15:P:15 16:S:16 17:Cl:17 18:Ar:18",
  },
  {
    period: 4,
    entries:
      "1:K:19 2:Ca:20 3:Sc:21 4:Ti:22 5:V:23 6:Cr:24 7:Mn:25 8:Fe:26 9:Co:27 10:Ni:28 11:Cu:29 12:Zn:30 13:Ga:31 14:Ge:32 15:As:33 16:Se:34 17:Br:35 18:Kr:36",
  },
  {
    period: 5,
    entries:
      "1:Rb:37 2:Sr:38 3:Y:39 4:Zr:40 5:Nb:41 6:Mo:42 7:Tc:43 8:Ru:44 9:Rh:45 10:Pd:46 11:Ag:47 12:Cd:48 13:In:49 14:Sn:50 15:Sb:51 16:Te:52 17:I:53 18:Xe:54",
  },
  {
    period: 6,
    entries:
      "1:Cs:55 2:Ba:56 3:57-71 4:Hf:72 5:Ta:73 6:W:74 7:Re:75 8:Os:76 9:Ir:77 10:Pt:78 11:Au:79 12:Hg:80 13:Tl:81 14:Pb:82 15:Bi:83 16:Po:84 17:At:85 18:Rn:86",
  },
  {
    period: 7,
    entries:
      "1:Fr:87 2:Ra:88 3:89-103 4:Rf:104 5:Db:105 6:Sg:106 7:Bh:107 8:Hs:108 9:Mt:109 10:Ds:110 11:Rg:111 12:Cn:112 13:Nh:113 14:Fl:114 15:Mc:115 16:Lv:116 17:Ts:117 18:Og:118",
  },
];

const PERIODIC_SERIES_ROW_SOURCE = [
  {
    key: "lanthanide",
    entries:
      "57:La 58:Ce 59:Pr 60:Nd 61:Pm 62:Sm 63:Eu 64:Gd 65:Tb 66:Dy 67:Ho 68:Er 69:Tm 70:Yb 71:Lu",
  },
  {
    key: "actinide",
    entries:
      "89:Ac 90:Th 91:Pa 92:U 93:Np 94:Pu 95:Am 96:Cm 97:Bk 98:Cf 99:Es 100:Fm 101:Md 102:No 103:Lr",
  },
];

export type PeriodicSeriesRowKey =
  (typeof PERIODIC_SERIES_ROW_SOURCE)[number]["key"];

/** Expected failure: an authored periodic-table text row cannot be read. */
class PeriodicTableSourceError extends Schema.TaggedError<PeriodicTableSourceError>()(
  "PeriodicTableSourceError",
  {
    message: Schema.String,
    source: Schema.String,
  }
) {}

/**
 * Finds the learning category used for one element tile.
 */
function getElementCategory(symbol: string) {
  return Result.map(
    Result.fromOption(
      Arr.findFirst(ELEMENT_CATEGORY_GROUPS, ({ symbols }) =>
        Arr.contains(symbols.split(" "), symbol)
      ),
      () =>
        new PeriodicTableSourceError({
          message: `Missing periodic-table category for ${symbol}.`,
          source: symbol,
        })
    ),
    (category) => category.id
  );
}

/**
 * Parses a compact main-table entry in group:symbol:atomicNumber format.
 */
function parseMainEntry(source: string) {
  const [groupText, symbol, atomicNumberText] = source.split(":");
  const group = Number(groupText);

  if (!(groupText && symbol && Number.isInteger(group))) {
    return Result.fail(
      new PeriodicTableSourceError({
        message: `Invalid periodic-table entry: ${source}.`,
        source,
      })
    );
  }

  if (!atomicNumberText) {
    return Result.map(getElementCategory(symbol), (category) => ({
      category,
      group,
      symbol,
    }));
  }

  const atomicNumber = Number(atomicNumberText);

  if (!Number.isInteger(atomicNumber)) {
    return Result.fail(
      new PeriodicTableSourceError({
        message: `Invalid atomic number: ${source}.`,
        source,
      })
    );
  }

  return Result.map(getElementCategory(symbol), (category) => ({
    atomicNumber,
    category,
    group,
    symbol,
  }));
}

/**
 * Parses a detached f-block entry in atomicNumber:symbol format.
 */
function parseSeriesEntry(source: string) {
  const [atomicNumberText, symbol] = source.split(":");
  const atomicNumber = Number(atomicNumberText);

  if (!(atomicNumberText && symbol && Number.isInteger(atomicNumber))) {
    return Result.fail(
      new PeriodicTableSourceError({
        message: `Invalid f-block entry: ${source}.`,
        source,
      })
    );
  }

  return Result.map(getElementCategory(symbol), (category) => ({
    atomicNumber,
    category,
    symbol,
  }));
}

export const MAIN_PERIODIC_TABLE_ROWS = Result.getOrThrow(
  Result.all(
    Arr.map(MAIN_PERIODIC_TABLE_SOURCE, (row) =>
      Result.map(
        Result.all(Arr.map(row.entries.split(" "), parseMainEntry)),
        (entries) => ({ period: row.period, entries })
      )
    )
  )
);

export const PERIODIC_SERIES_ROWS = Result.getOrThrow(
  Result.all(
    Arr.map(PERIODIC_SERIES_ROW_SOURCE, (row) =>
      Result.map(
        Result.all(Arr.map(row.entries.split(" "), parseSeriesEntry)),
        (entries) => ({ key: row.key, entries })
      )
    )
  )
);

export type PeriodicElementEntry =
  (typeof MAIN_PERIODIC_TABLE_ROWS)[number]["entries"][number];

/** The categories, series rows, and symbols one periodic-table focus highlights. */
const ModernPeriodicTableFocusSchema = Schema.Struct({
  categories: Schema.Array(PeriodicElementCategoryIdSchema),
  seriesKeys: Schema.Array(Schema.String),
  symbols: Schema.Array(Schema.String),
});

export const MODERN_PERIODIC_TABLE_FOCI = {
  [GROUP_ONE_FOCUS_ID]: {
    categories: [],
    seriesKeys: [],
    symbols: ["H", "Li", "Na", "K", "Rb", "Cs", "Fr"],
  },
  [PERIOD_THREE_FOCUS_ID]: {
    categories: [],
    seriesKeys: [],
    symbols: ["Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar"],
  },
  [TRANSITION_FOCUS_ID]: {
    categories: [TRANSITION_CATEGORY_ID],
    seriesKeys: [],
    symbols: [],
  },
  [INNER_TRANSITION_FOCUS_ID]: {
    categories: [SERIES_MARKER_CATEGORY_ID],
    seriesKeys: ["lanthanide", "actinide"],
    symbols: [],
  },
  [METALLOID_FOCUS_ID]: {
    categories: [],
    seriesKeys: [],
    symbols: ["B", "Si", "Ge", "As", "Sb", "Te", "Po"],
  },
  [NOBLE_GAS_FOCUS_ID]: {
    categories: [NOBLE_GAS_CATEGORY_ID],
    seriesKeys: [],
    symbols: [],
  },
} satisfies Record<
  ModernPeriodicTableFocusId,
  typeof ModernPeriodicTableFocusSchema.Type
>;

const ModernPeriodicTableSceneLabelsSchema = Schema.Struct({
  group: Schema.String,
  period: Schema.String,
  seriesNames: Schema.Record(Schema.String, Schema.String),
});
export type ModernPeriodicTableSceneLabels =
  typeof ModernPeriodicTableSceneLabelsSchema.Type;

/**
 * Narrows ToggleGroup string values to the available periodic-table focus modes.
 */
export function isModernPeriodicTableFocusId(
  value: string
): value is ModernPeriodicTableFocusId {
  return Arr.some(
    MODERN_PERIODIC_TABLE_FOCUS_IDS,
    (focusId) => focusId === value
  );
}

export type ModernPeriodicTableSceneColors = ReturnType<
  typeof getModernPeriodicTableSceneColors
>;

/**
 * Chooses stable, theme-aware colors for the 3D periodic-table model.
 */
export function getModernPeriodicTableSceneColors(
  resolvedTheme: string | undefined
) {
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";

  return {
    groundLight: isDarkTheme ? getColor("SLATE") : getColor("STONE"),
    innerTransition: getColor("ROSE"),
    metal: getColor("TEAL"),
    metalloid: getColor("VIOLET"),
    nobleGas: getColor("SKY"),
    nonmetal: getColor("EMERALD"),
    seriesMarker: getColor("ROSE"),
    skyLight: ORIGIN_COLOR.LIGHT,
    text: isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK,
    textOutline: isDarkTheme ? ORIGIN_COLOR.DARK : ORIGIN_COLOR.LIGHT,
    tileText: ORIGIN_COLOR.LIGHT,
    tileTextOutline: ORIGIN_COLOR.DARK,
    transitionMetal: getColor("AMBER"),
  };
}

/**
 * Resolves the visible color for a periodic-table learning category.
 */
export function getModernPeriodicTableCategoryColor(
  colors: ModernPeriodicTableSceneColors,
  category: PeriodicElementCategoryId
) {
  return colors[MODERN_PERIODIC_TABLE_CATEGORY_COLOR_KEYS[category]];
}
