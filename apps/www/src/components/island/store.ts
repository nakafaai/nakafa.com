import type { Operation } from "@repo/backend/confect/island/operation";
import type { Shelf, Thing } from "@repo/backend/confect/island/things";
import { useRequired } from "@repo/design-system/hooks/required";
import { Array as Arr, Option, Schema } from "effect";
import { createContext } from "react";
import { createStore, useStore } from "zustand";
import type { Deed } from "@/lib/island/cues";
import type { Change } from "@/lib/island/land/changes";
import { applyChanges, joinedOf, undoneOf } from "@/lib/island/land/changes";
import type { Land } from "@/lib/island/land/ground";
import { opsOf } from "@/lib/island/land/ops";
import type { Brush } from "@/lib/island/land/stroke";
import type { Season } from "@/lib/island/season";
import type { Weather } from "@/lib/island/sky";
import type { Footing } from "@/lib/island/steps";

/** What the learner's hands do in the world (ADR 0050, W7): walk it and meet what lives there, set things down, or shape the land. */
export const Mode = Schema.Literals(["explore", "build", "brush"]);
export type Mode = typeof Mode.Type;

/** The sheets the HUD opens over the world, one at a time. */
export const Sheet = Schema.Literals([
  "animals",
  "class",
  "map",
  "share",
  "guests",
]);
export type Sheet = typeof Sheet.Type;

/**
 * What the game tells the learner in a line: a thing with no room where it
 * was pressed, one that needs water or dry land, ground too steep for it, a
 * chunk or a world that holds all it can, a change the server refused, a
 * blueprint they cannot afford yet, a place too far to walk to, a bite on the
 * line and a fish that got away, and a world that is only theirs to look at.
 */
export const Notice = Schema.Literals([
  "room",
  "water",
  "dry",
  "steep",
  "full",
  "refused",
  "short",
  "far",
  "bite",
  "escaped",
  "guest",
]);
export type Notice = typeof Notice.Type;

/** The learner's lifetime Stars between the level they reached and the next one. */
export const Progress = Schema.Struct({
  from: Schema.Finite,
  lifetime: Schema.Finite,
  next: Schema.Finite,
});
export type Progress = typeof Progress.Type;

/** One thing of a world, named by its chunk and its place on the chunk's half-block grid. */
export const Spot = Schema.Struct({
  at: Schema.Int,
  cx: Schema.Int,
  cz: Schema.Int,
});
export type Spot = typeof Spot.Type;

/** Whose world the game shows when it is not the learner's own (ADR 0050, W6). */
export const Host = Schema.Struct({
  level: Schema.Int,
  name: Schema.String,
  username: Schema.String,
});
export type Host = typeof Host.Type;

/** How many steps undo keeps. */
const HISTORY = 64;

/**
 * What the game's own actions write (ADR 0050, W2, W4 and W7): the land and
 * what the learner changed on it, the steps undo and redo walk, the operations
 * the server has not taken yet, the hand the learner plays with, the
 * blueprints they opened, and what the HUD shows. The land is changed in
 * place, so `revision` rises with every change for the readers that draw it.
 */
interface GameStore {
  /** Adds a catch, which the HUD shows and the field guide marks. */
  addCatch: (species: number) => void;
  /** Whether the server answered the learner's entry, which tells a first visit from a later one. */
  answered: boolean;
  /** Records that a region's stored chunks were laid over the land. */
  arrive: (region: number) => void;
  /** The blueprints the learner opened with Stars (W5). */
  blueprints: readonly Thing[];
  /** The brush in hand while the mode is "brush". */
  brush: Brush;
  /** The species the learner caught today, by their place in the catalog, the latest last. */
  catches: readonly number[];
  /** The catch the HUD shows now, none once it faded. */
  caught: number | null;
  /** Lets the catch the HUD shows fade. */
  clearCaught: () => void;
  /**
   * Writes changes into the land as one step the learner can undo, and queues
   * them for the server. With `join`, they join the step before, so one
   * stroke of a brush is one step however long it ran.
   */
  commit: (changes: readonly Change[], join?: boolean) => void;
  /** The fox's latest deed that changes nothing in the world, and how many it did, which the sound answers one by one (W8). */
  deed: { readonly count: number; readonly kind: Deed };
  /** Records a deed of the fox: a line cast, an animal stroked, a tree shaken. */
  did: (kind: Deed) => void;
  /** When the learner entered their world before this time, in epoch milliseconds, none before the first; the guest book marks who came since. */
  entered: number | null;
  /** Whether this is the learner's first time in their world, which opens with a gift (W5). */
  first: boolean;
  /** What the fox's last footstep landed on (D40). */
  footing: Footing;
  future: readonly (readonly Change[])[];
  /** Writes the changes of a gift into the land and queues them for the server, outside the steps undo walks. */
  grant: (changes: readonly Change[]) => void;
  /** Holds a thing, which the next press sets down, or nothing. */
  hold: (item: Thing | null) => void;
  /** Where the world opens: the learner's home, found from the seed (W1). */
  home: readonly [number, number];
  /** Whose world this is when it is not the learner's own; they change nothing in it (W6). */
  host: Host | null;
  /** The thing in hand while the mode is "build", none when the hand picks things up instead. */
  item: Thing | null;
  /** The land and everything the learner changed on it. */
  land: Land;
  /** Leaves the game for the page the learner came from. */
  leave: () => void;
  /** The learner's level (ADR 0047, D29). */
  level: number;
  /** The regions whose stored chunks the land already holds, by their keys. */
  loaded: readonly number[];
  /** The minute of the learner's day the clock shows, from 0 to 1439. */
  minute: number;
  mode: Mode;
  /** Whether the next press sets the selected thing down at a new place. */
  moving: boolean;
  /** Whether the learner turned the world's sound off. */
  muted: boolean;
  /** What the game tells the learner, none most of the time. */
  notice: Notice | null;
  /** Records the blueprints the server holds after one was opened. */
  opened: (blueprints: readonly Thing[]) => void;
  past: readonly (readonly Change[])[];
  /** What the server has not taken yet, in the order it changed. */
  pending: readonly Operation[];
  /** Where the fox stands, to the nearest couple of blocks, which the map marks. */
  place: readonly [number, number];
  /** The learner's lifetime Stars, the Stars that opened this level, and those that open the next. */
  progress: Progress;
  redo: () => void;
  /** Rises whenever the land changed, by the learner's hand or by what the server held. */
  revision: number;
  /** The learner's season, which tints the turf and the leaves (D8). */
  season: Season;
  /** Picks a thing up, or lets go of it. */
  select: (spot: Spot | null) => void;
  /** The thing the learner picked up to move, turn or take away, none when nothing is. */
  selected: Spot | null;
  setBrush: (brush: Brush) => void;
  setEntered: (entered: number | null) => void;
  setMinute: (minute: number) => void;
  setMode: (mode: Mode) => void;
  setMoving: (moving: boolean) => void;
  setMuted: (muted: boolean) => void;
  setNotice: (notice: Notice | null) => void;
  setPlace: (place: readonly [number, number]) => void;
  setSheet: (sheet: Sheet | null) => void;
  setShelf: (shelf: typeof Shelf.Type) => void;
  /** Records that the server took the first `count` pending operations. */
  settle: (count: number) => void;
  setWeather: (weather: Weather) => void;
  /** The sheet open over the world, none most of the time. */
  sheet: Sheet | null;
  /** The shelf of things the build tools show. */
  shelf: typeof Shelf.Type;
  /** Records that the world's first frame is on the screen. */
  show: () => void;
  /** Whether the world's first frame is on the screen; the HUD waits over the canvas until it is. */
  shown: boolean;
  /** How many footsteps the fox took, which the sound answers one by one (D40). */
  steps: number;
  /** Records one footstep of the fox on a footing. */
  tread: (footing: Footing) => void;
  /** How many quarter turns the next thing is set down with. */
  turn: number;
  /** Turns the thing in hand a quarter. */
  turnHand: () => void;
  undo: () => void;
  /** Asks for the regions about the camera, by their keys; the sync reads the ones the land does not hold yet. */
  want: (regions: readonly number[]) => void;
  /** The regions about the camera. */
  wanted: readonly number[];
  /** The weather over the world: the learner's own, clear until it is read (D8). */
  weather: Weather;
  /** Records that the learner entered their world for the first time. */
  welcome: () => void;
}

/** What a game opens with: its land, the learner's level and blueprints, whose world it is, and the way out. */
type GameSetup = Pick<
  GameStore,
  | "blueprints"
  | "home"
  | "host"
  | "land"
  | "leave"
  | "loaded"
  | "level"
  | "muted"
  | "progress"
  | "season"
>;

/** Creates the store of one game, which lives and ends with its provider. */
export function createGameStore(setup: GameSetup) {
  return createStore<GameStore>()((set, get) => {
    /** Writes changes into the land and queues them for the server, without touching history. */
    const write = (changes: readonly Change[]) => {
      applyChanges(get().land, changes);
      set((state) => ({
        pending: Arr.appendAll(state.pending, opsOf(changes)),
        revision: state.revision + 1,
      }));
    };
    return {
      ...setup,
      answered: false,
      addCatch: (species) =>
        set((state) => ({
          catches: Arr.append(state.catches, species),
          caught: species,
        })),
      arrive: (region) =>
        set((state) => ({
          loaded: Arr.append(state.loaded, region),
          revision: state.revision + 1,
        })),
      brush: "path",
      catches: [],
      caught: null,
      clearCaught: () => set({ caught: null }),
      commit: (changes, join = false) => {
        if (changes.length === 0 || get().host !== null) {
          return;
        }
        write(changes);
        set((state) => {
          const before = join ? Arr.last(state.past) : Option.none();
          const step = Option.match(before, {
            onNone: () => changes,
            onSome: (last) => joinedOf(last, changes),
          });
          const kept = Option.isSome(before)
            ? Arr.dropRight(state.past, 1)
            : state.past;
          return {
            future: [],
            notice: null,
            past: Arr.takeRight(Arr.append(kept, step), HISTORY),
          };
        });
      },
      deed: { count: 0, kind: "cast" },
      did: (kind) =>
        set((state) => ({ deed: { count: state.deed.count + 1, kind } })),
      entered: null,
      first: false,
      footing: "grass",
      grant: (changes) => {
        write(changes);
        set({ first: false });
      },
      future: [],
      hold: (item) => set({ item, moving: false, selected: null }),
      item: null,
      minute: 0,
      mode: "explore",
      moving: false,
      notice: null,
      opened: (blueprints) => set({ blueprints }),
      past: [],
      pending: [],
      place: setup.home,
      redo: () => {
        const step = Arr.last(get().future);
        if (Option.isNone(step)) {
          return;
        }
        write(step.value);
        set((state) => ({
          future: Arr.dropRight(state.future, 1),
          past: Arr.append(state.past, step.value),
          selected: null,
        }));
      },
      revision: 0,
      select: (selected) => set({ item: null, moving: false, selected }),
      selected: null,
      setBrush: (brush) => set({ brush }),
      setEntered: (entered) => set({ answered: true, entered }),
      setMinute: (minute) => set({ minute }),
      setMode: (mode) =>
        set({ item: null, mode, moving: false, selected: null, sheet: null }),
      setMoving: (moving) => set({ moving }),
      setMuted: (muted) => set({ muted }),
      setNotice: (notice) => set({ notice }),
      setPlace: (place) => set({ place }),
      setSheet: (sheet) => set({ sheet }),
      setShelf: (shelf) => set({ shelf }),
      settle: (count) =>
        set((state) => ({ pending: Arr.drop(state.pending, count) })),
      setWeather: (weather) => set({ weather }),
      sheet: null,
      shelf: "nature",
      show: () => set({ shown: true }),
      shown: false,
      steps: 0,
      tread: (footing) => set((state) => ({ footing, steps: state.steps + 1 })),
      turn: 0,
      want: (wanted) => set({ wanted }),
      wanted: [],
      turnHand: () => set((state) => ({ turn: (state.turn + 1) % 4 })),
      undo: () => {
        const step = Arr.last(get().past);
        if (Option.isNone(step)) {
          return;
        }
        write(undoneOf(step.value));
        set((state) => ({
          future: Arr.append(state.future, step.value),
          past: Arr.dropRight(state.past, 1),
          selected: null,
        }));
      },
      weather: "clear",
      welcome: () => set({ first: true }),
    };
  });
}

export type GameStoreApi = ReturnType<typeof createGameStore>;

export const GameStoreContext = createContext<GameStoreApi | null>(null);

/** Reads one value of the game's store. */
export function useGame<T>(selector: (state: GameStore) => T) {
  const store = useRequired(GameStoreContext, "useGame");
  return useStore(store, selector);
}
