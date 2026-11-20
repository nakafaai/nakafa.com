import { PARTS } from "@repo/design-system/components/contents/mathematics/logic/rig";
import type {
  Case,
  LogicMode,
} from "@repo/design-system/components/contents/mathematics/logic/truth";
import { Array as Arr, Record as Rec, Schema } from "effect";

/** The parts of the kit: the two cells, the two switches, the lamp, and the resistor not p needs. */
const PartNameSchema = Schema.Literals([
  "battery",
  "p",
  "q",
  "lamp",
  "resistor",
]);
export type PartName = typeof PartNameSchema.Type;

/** A point on the board, as (x, z). */
const SpotSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);

/** Where a part stands on the board: its middle (x, z), and its turn about the vertical. */
const PlacementSchema = Schema.Struct({
  at: SpotSchema,
  turn: Schema.Finite,
});
export type Placement = typeof PlacementSchema.Type;

/** One terminal post: the part, and which end of its base, a before b along its length. */
const TerminalSchema = Schema.Struct({
  part: PartNameSchema,
  side: Schema.Literals(["a", "b"]),
});

/** One terminal post of a part a layout places. */
interface Terminal<Part extends PartName> {
  readonly part: Part;
  readonly side: "a" | "b";
}

/** The colours leads come in. */
const LeadColorSchema = Schema.Literals([
  "red",
  "black",
  "yellow",
  "blue",
  "green",
  "orange",
]);
export type LeadColor = typeof LeadColorSchema.Type;

/**
 * When a lead carries current: always, only while p or q is closed, while
 * both are, or while either is.
 */
const FlowSchema = Schema.Literals(["always", "p", "q", "both", "either"]);
type Flow = typeof FlowSchema.Type;

/** One lead as a layout writes it, in the direction conventional current runs along it. */
interface LeadPlan<Part extends PartName> {
  readonly color: LeadColor;
  readonly flow: Flow;
  readonly from: Terminal<Part>;
  readonly to: Terminal<Part>;
  readonly via: readonly [
    typeof SpotSchema.Type,
    ...(typeof SpotSchema.Type)[],
  ];
}

/** One lead on the board, in the direction conventional current runs along it, with where its two posts stand. */
const LeadSchema = Schema.Struct({
  color: LeadColorSchema,
  end: SpotSchema,
  flow: FlowSchema,
  from: TerminalSchema,
  start: SpotSchema,
  to: TerminalSchema,
  via: Schema.NonEmptyArray(SpotSchema),
});

/** One compound wired on the board: the parts it stands there and how the leads run. */
const LayoutSchema = Schema.Struct({
  leads: Schema.Array(LeadSchema),
  parts: Schema.Array(
    Schema.Struct({ name: PartNameSchema, placement: PlacementSchema })
  ),
});
export type Layout = typeof LayoutSchema.Type;

/** A part lying along the board's depth, its terminal a at the back. */
const ALONG_DEPTH = -Math.PI / 2;

/** The cells stand at the left, their positive post at the back, in every layout. */
export const BATTERY: Placement = { at: [-0.15, 0], turn: ALONG_DEPTH };

/** The lamp stands at the right, its post a at the back. */
const LAMP: Placement = { at: [0.15, 0.03], turn: ALONG_DEPTH };

/** The return lead from the lamp along the front of the board to the negative post. */
const RETURN = [
  [0.15, 0.11],
  [0, 0.118],
  [-0.15, 0.115],
] as const;

/** The terminal post of one part. */
function post<Part extends PartName>(part: Part, side: "a" | "b") {
  return { part, side };
}

/** A layout whose leads run between the posts of the parts it places. */
function wired<Part extends PartName>(
  parts: Readonly<Record<Part, Placement>>,
  leads: readonly LeadPlan<Part>[]
): Layout {
  return {
    leads: Arr.map(leads, (lead) => ({
      ...lead,
      end: postAt(parts[lead.to.part], lead.to),
      start: postAt(parts[lead.from.part], lead.from),
    })),
    parts: Arr.map(Rec.toEntries(parts), ([name, placement]) => ({
      name,
      placement,
    })),
  };
}

/**
 * The circuit of each compound. In "and" the leads run from the cells through
 * P, then Q, to the lamp, one path for the current. In "or" P and Q each get a
 * lead from the positive post and a lead to the lamp, two paths side by side.
 * In "not" a resistor feeds the lamp and P is wired across the lamp, so a
 * closed P carries the current past it; the resistor keeps that path from
 * shorting the cells. Every lead turns well clear of its clips, so it lies
 * on the board the way a lead dropped from a post does.
 */
export const LAYOUTS: Readonly<Record<LogicMode, Layout>> = {
  and: wired(
    {
      battery: BATTERY,
      lamp: LAMP,
      p: { at: [-0.045, -0.075], turn: 0 },
      q: { at: [0.075, -0.075], turn: 0 },
    },
    [
      {
        color: "red",
        flow: "both",
        from: post("battery", "a"),
        to: post("p", "a"),
        via: [
          [-0.13, -0.115],
          [-0.1, -0.122],
        ],
      },
      {
        color: "yellow",
        flow: "both",
        from: post("p", "b"),
        to: post("q", "a"),
        via: [
          [-0.02, -0.13],
          [0.05, -0.13],
        ],
      },
      {
        color: "blue",
        flow: "both",
        from: post("q", "b"),
        to: post("lamp", "a"),
        via: [[0.16, -0.1]],
      },
      {
        color: "black",
        flow: "both",
        from: post("lamp", "b"),
        to: post("battery", "b"),
        via: RETURN,
      },
    ]
  ),
  not: wired(
    {
      battery: BATTERY,
      lamp: LAMP,
      p: { at: [0.06, 0.03], turn: ALONG_DEPTH },
      resistor: { at: [-0.02, -0.085], turn: 0 },
    },
    [
      {
        color: "red",
        flow: "always",
        from: post("battery", "a"),
        to: post("resistor", "a"),
        via: [
          [-0.12, -0.112],
          [-0.085, -0.118],
        ],
      },
      {
        color: "yellow",
        flow: "always",
        from: post("resistor", "b"),
        to: post("lamp", "a"),
        via: [
          [0.05, -0.115],
          [0.16, -0.06],
        ],
      },
      {
        color: "green",
        flow: "p",
        from: post("lamp", "a"),
        to: post("p", "a"),
        via: [[0.105, -0.035]],
      },
      {
        color: "blue",
        flow: "p",
        from: post("p", "b"),
        to: post("lamp", "b"),
        via: [[0.105, 0.1]],
      },
      {
        color: "black",
        flow: "always",
        from: post("lamp", "b"),
        to: post("battery", "b"),
        via: RETURN,
      },
    ]
  ),
  or: wired(
    {
      battery: BATTERY,
      lamp: LAMP,
      p: { at: [0, -0.08], turn: 0 },
      q: { at: [0, 0.01], turn: 0 },
    },
    [
      {
        color: "red",
        flow: "p",
        from: post("battery", "a"),
        to: post("p", "a"),
        via: [
          [-0.12, -0.112],
          [-0.07, -0.118],
        ],
      },
      {
        color: "orange",
        flow: "q",
        from: post("battery", "a"),
        to: post("q", "a"),
        via: [
          [-0.1, -0.02],
          [-0.085, 0.012],
        ],
      },
      {
        color: "yellow",
        flow: "p",
        from: post("p", "b"),
        to: post("lamp", "a"),
        via: [
          [0.08, -0.105],
          [0.16, -0.06],
        ],
      },
      {
        color: "blue",
        flow: "q",
        from: post("q", "b"),
        to: post("lamp", "a"),
        via: [[0.095, -0.025]],
      },
      {
        color: "black",
        flow: "either",
        from: post("lamp", "b"),
        to: post("battery", "b"),
        via: RETURN,
      },
    ]
  ),
};

/** The base each part stands on. */
export function baseOf(part: PartName) {
  if (part === "p" || part === "q") {
    return PARTS.switch;
  }
  return PARTS[part];
}

/**
 * Where a terminal post stands on the board, as (x, z). A part turned by
 * `turn` about the vertical carries its length along (cos turn, -sin turn),
 * as three.js turns an object.
 */
export function postAt(placement: Placement, terminal: Terminal<PartName>) {
  const reach = baseOf(terminal.part).reach;
  const along = terminal.side === "a" ? -reach : reach;
  const [x, z] = placement.at;
  return [
    x + along * Math.cos(placement.turn),
    z - along * Math.sin(placement.turn),
  ] as const;
}

/** Whether a lead carries current in one case. */
export function carries(flow: Flow, { p, q }: Case) {
  if (flow === "always") {
    return true;
  }
  if (flow === "p") {
    return p;
  }
  if (flow === "q") {
    return q;
  }
  return flow === "both" ? p && q : p || q;
}

/**
 * How many clips sit under one end of a lead on its post: leads clipped to the
 * same post stack up, the earlier lead lower, its start before its end.
 */
export function stackOf(layout: Layout, lead: number, end: "from" | "to") {
  const ends = Arr.flatMap(layout.leads, (each) => [each.from, each.to]);
  const index = lead * 2 + (end === "from" ? 0 : 1);
  const terminal = Arr.getUnsafe(ends, index);
  return Arr.filter(Arr.take(ends, index), (each) =>
    isPost(each, terminal.part, terminal.side)
  ).length;
}

/** Whether a terminal is one post of one part. */
function isPost(terminal: Terminal<PartName>, part: PartName, side: "a" | "b") {
  return terminal.part === part && terminal.side === side;
}

/**
 * Whether current runs through the lamp in one case: the live leads bring
 * current to the lamp's post a, and any live lead that leaves that post
 * carries it on past the lamp instead, as a closed switch across it does.
 */
export function lampLit(layout: Layout, state: Case) {
  const live = Arr.filter(layout.leads, (lead) => carries(lead.flow, state));
  const arriving = Arr.filter(live, (lead) => isPost(lead.to, "lamp", "a"));
  const leaving = Arr.filter(live, (lead) => isPost(lead.from, "lamp", "a"));
  return arriving.length > leaving.length;
}
