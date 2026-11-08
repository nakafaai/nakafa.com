import { HashMap, Option, Schema } from "effect";
import { createStore } from "zustand";
import type { LineSide } from "@/components/player/lines/context";
import { LinePoint } from "@/components/player/lines/curve";

/** The middle of each dot of a board, by the part it belongs to. */
const LinePoints = Schema.Record(Schema.String, LinePoint);

/** Whether two measures of a board's dots put every dot in the same place. */
const samePoints = Schema.toEquivalence(LinePoints);

/** What one board holds while a person draws on it. */
const LinesState = Schema.Struct({
  /** The statement whose line a pull just drew, which shows at once instead of growing, since the pull drew it. */
  drawn: Schema.Option(Schema.String),
  /** The statement in hand, pulled or pressed, which the next answer pressed or pulled to takes. */
  held: Schema.Option(Schema.String),
  /** The statement whose line a pointer or the keyboard is on, which shows the line's remove control. */
  lit: Schema.Option(Schema.String),
  /** The answer under a pull, which shows that a release lands there. */
  over: Schema.Option(Schema.String),
  points: LinePoints,
  /** Where the free end of a pull stands. */
  tip: Schema.Option(LinePoint),
});

/**
 * The elements a board measures, which each one registers as it mounts: every dot by its part, the middle its line
 * meets, and each column's list, whose size changes move its dots. Elements are no data a Schema describes, and two
 * of them compare by reference alone, since Effect's equality reads two elements with no fields of their own as one.
 */
interface LinesAnchors {
  readonly anchors: HashMap.HashMap<string, HTMLElement>;
  readonly columns: HashMap.HashMap<LineSide, HTMLElement>;
}

/** The actions of one board. */
interface LinesActions {
  /** Registers the dot of a part, which the board measures from now on. */
  readonly anchor: (part: string, dot: HTMLElement) => void;
  /** Registers the list of a column, whose size the board follows. */
  readonly frame: (side: LineSide, list: HTMLElement) => void;
  /** Points at the line of a statement, or at no line. */
  readonly light: (source: Option.Option<string>) => void;
  /** Keeps where each dot stands now, and changes nothing when no dot moved. */
  readonly place: (points: typeof LinePoints.Type) => void;
  /** Pulls a statement's line to `tip`, over the answer a release there would pair, if any. */
  readonly pull: (
    source: string,
    tip: LinePoint,
    over: Option.Option<string>
  ) => void;
  /** Ends the hold and the pull, with the statement whose line the pull drew, if it drew one. */
  readonly release: (drawn: Option.Option<string>) => void;
  /** Takes a statement in hand, or puts it down when it is in hand already. */
  readonly take: (source: string) => void;
  /** Forgets the dot of a part, unless another element took its place since. */
  readonly unanchor: (part: string, dot: HTMLElement) => void;
  /** Forgets the list of a column, unless another list took its place since. */
  readonly unframe: (side: LineSide, list: HTMLElement) => void;
}

/** One board's state and its actions. */
export type LinesStore = typeof LinesState.Type & LinesAnchors & LinesActions;

/** Creates the state of one board, with nothing in hand. */
export const createLines = () =>
  createStore<LinesStore>()((set) => ({
    anchor: (part, dot) =>
      set((state) => ({ anchors: HashMap.set(state.anchors, part, dot) })),
    anchors: HashMap.empty(),
    columns: HashMap.empty(),
    drawn: Option.none(),
    frame: (side, list) =>
      set((state) => ({ columns: HashMap.set(state.columns, side, list) })),
    held: Option.none(),
    light: (lit) => set({ lit }),
    lit: Option.none(),
    over: Option.none(),
    place: (points) =>
      set((state) => (samePoints(state.points, points) ? state : { points })),
    points: {},
    pull: (source, tip, over) =>
      set({ held: Option.some(source), over, tip: Option.some(tip) }),
    release: (drawn) =>
      set({
        drawn,
        held: Option.none(),
        over: Option.none(),
        tip: Option.none(),
      }),
    take: (source) =>
      set((state) => ({
        drawn: Option.none(),
        held: Option.contains(state.held, source)
          ? Option.none()
          : Option.some(source),
      })),
    tip: Option.none(),
    unanchor: (part, dot) =>
      set((state) =>
        Option.exists(HashMap.get(state.anchors, part), (held) => held === dot)
          ? { anchors: HashMap.remove(state.anchors, part) }
          : state
      ),
    unframe: (side, list) =>
      set((state) =>
        Option.exists(HashMap.get(state.columns, side), (held) => held === list)
          ? { columns: HashMap.remove(state.columns, side) }
          : state
      ),
  }));
