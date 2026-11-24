import {
  getMaxWebGLContexts,
  isMobileDevice,
} from "@repo/design-system/lib/device";
import {
  Array as Arr,
  HashMap,
  MutableHashMap,
  Option,
  Order,
  Schema,
} from "effect";
import { createStore } from "zustand";

/** One canvas registered with the page's WebGL context pool. */
const PoolEntrySchema = Schema.Struct({
  active: Schema.Boolean,
  id: Schema.String,
  lastUsed: Schema.Finite,
  nearViewport: Schema.Boolean,
});
type PoolEntry = typeof PoolEntrySchema.Type;

/** Snapshot of all registered WebGL canvases, keyed by canvas id. */
const PoolSnapshotSchema = Schema.Struct({
  entries: Schema.Record(Schema.String, PoolEntrySchema),
});
type PoolSnapshot = typeof PoolSnapshotSchema.Type;

const byOldest = Order.mapInput(
  Order.Number,
  (entry: PoolEntry) => entry.lastUsed
);

const byNewest = Order.flip(byOldest);

/** Orders active eviction victims: off-screen entries first, then oldest `lastUsed`. */
function selectEvictionVictims(
  entries: HashMap.HashMap<string, PoolEntry>,
  excludeId: string,
  count: number
): readonly PoolEntry[] {
  const candidates = Arr.filter(
    HashMap.values(entries),
    (entry) => entry.active && entry.id !== excludeId
  );
  const offscreen = Arr.sort(
    Arr.filter(candidates, (entry) => !entry.nearViewport),
    byOldest
  );
  const onscreen = Arr.sort(
    Arr.filter(candidates, (entry) => entry.nearViewport),
    byOldest
  );
  return Arr.take(Arr.appendAll(offscreen, onscreen), count);
}

/** Finds the most recently touched near-viewport entry that does not hold a slot yet. */
function selectWaitingNearEntry(
  entries: HashMap.HashMap<string, PoolEntry>
): Option.Option<PoolEntry> {
  const waiting = Arr.filter(
    HashMap.values(entries),
    (entry) => entry.nearViewport && !entry.active
  );
  return Arr.head(Arr.sort(waiting, byNewest));
}

/** Converts an Effect HashMap of entries to a plain snapshot record for Zustand subscribers. */
function toRecord(
  entries: HashMap.HashMap<string, PoolEntry>
): Record<string, PoolEntry> {
  const record: Record<string, PoolEntry> = {};
  for (const [key, value] of entries) {
    record[key] = value;
  }
  return record;
}

/** Counts how many entries currently hold an active WebGL context lease. */
function countActive(entries: HashMap.HashMap<string, PoolEntry>): number {
  return Arr.length(
    Arr.filter(HashMap.values(entries), (entry) => entry.active)
  );
}

/** Counts active entries currently near the viewport, excluding one id. */
function countOtherActiveNear(
  entries: HashMap.HashMap<string, PoolEntry>,
  excludeId: string
): number {
  return Arr.length(
    Arr.filter(
      HashMap.values(entries),
      (entry) => entry.active && entry.nearViewport && entry.id !== excludeId
    )
  );
}

/**
 * Creates a bounded LRU WebGL context pool that coordinates active GPU contexts
 * across every Three.js canvas on a page.
 *
 * When the pool reaches its device limit (2 on mobile/low-end, 4 on desktop),
 * acquiring a slot for a newly visible canvas evicts the least-recently-used
 * off-screen canvas first, running its synchronous disposal hook before the new
 * canvas asks the browser for a context. If a fast scroll jump briefly evicts a
 * still-visible canvas before distant canvases report off-screen, the pool
 * promotes that waiting visible canvas as soon as an off-screen slot frees up.
 */
export function createContextPool(options: {
  readonly getLimit: () => number;
  readonly isMobile: () => boolean;
}) {
  let entries = HashMap.empty<string, PoolEntry>();
  let sequence = 0;
  const evictors = MutableHashMap.empty<string, () => void>();
  const store = createStore<PoolSnapshot>(() => ({ entries: {} }));

  const publish = () => {
    store.setState({ entries: toRecord(entries) });
  };

  const evictActiveEntry = (entry: PoolEntry) => {
    entries = HashMap.set(entries, entry.id, { ...entry, active: false });
    Option.map(MutableHashMap.get(evictors, entry.id), (callback) =>
      callback()
    );
  };

  /** Grants available slots (up to limit) to any waiting near-viewport canvases. */
  const promoteWaiting = () => {
    const limit = Math.max(1, options.getLimit());
    while (countActive(entries) < limit) {
      const next = selectWaitingNearEntry(entries);
      if (Option.isNone(next)) {
        break;
      }
      sequence += 1;
      entries = HashMap.set(entries, next.value.id, {
        ...next.value,
        active: true,
        lastUsed: sequence,
      });
    }
  };

  /**
   * Requests an active WebGL slot for `id`, evicting off-screen or older
   * entries when the pool is at capacity.
   */
  const acquire = (id: string, onEvict: () => void): boolean => {
    sequence += 1;
    MutableHashMap.set(evictors, id, onEvict);
    const existing = HashMap.get(entries, id);
    if (Option.isSome(existing) && existing.value.active) {
      entries = HashMap.set(entries, id, {
        ...existing.value,
        lastUsed: sequence,
        nearViewport: true,
      });
      publish();
      return true;
    }

    const limit = Math.max(1, options.getLimit());
    const excess = countActive(entries) - (limit - 1);
    if (excess > 0) {
      for (const victim of selectEvictionVictims(entries, id, excess)) {
        evictActiveEntry(victim);
      }
    }

    entries = HashMap.set(entries, id, {
      active: true,
      id,
      lastUsed: sequence,
      nearViewport: true,
    });
    publish();
    return true;
  };

  /**
   * Marks `id` as far from the viewport. Releases its slot immediately when a
   * waiting near-viewport canvas needs it, or on mobile whenever another
   * near-viewport scene is already active.
   */
  const markOffscreen = (id: string): void => {
    const existing = HashMap.get(entries, id);
    if (Option.isNone(existing)) {
      return;
    }
    const updated: PoolEntry = { ...existing.value, nearViewport: false };
    entries = HashMap.set(entries, id, updated);
    const hasWaiting = Option.isSome(selectWaitingNearEntry(entries));
    if (
      updated.active &&
      (hasWaiting ||
        (options.isMobile() && countOtherActiveNear(entries, id) > 0))
    ) {
      evictActiveEntry(updated);
      promoteWaiting();
    }
    publish();
  };

  /**
   * Evicts every active off-screen entry (optionally sparing `exceptId`) to
   * reclaim browser WebGL contexts before retrying a failed context start.
   */
  const releaseOffscreen = (exceptId?: string): number => {
    const victims = Arr.filter(
      HashMap.values(entries),
      (entry) => entry.active && !entry.nearViewport && entry.id !== exceptId
    );
    for (const victim of victims) {
      evictActiveEntry(victim);
    }
    const released = Arr.length(victims);
    if (released > 0) {
      publish();
    }
    return released;
  };

  /** Removes `id` from the pool when its canvas unmounts and promotes waiting entries. */
  const release = (id: string): void => {
    MutableHashMap.remove(evictors, id);
    if (!HashMap.has(entries, id)) {
      return;
    }
    entries = HashMap.remove(entries, id);
    promoteWaiting();
    publish();
  };

  /** Whether `id` currently owns an active WebGL context lease. */
  const hasSlot = (id: string): boolean =>
    Option.exists(HashMap.get(entries, id), (entry) => entry.active);

  /** Current number of active WebGL context leases in this pool. */
  const activeCount = (): number => countActive(entries);

  return {
    acquire,
    activeCount,
    hasSlot,
    markOffscreen,
    release,
    releaseOffscreen,
    store,
  };
}

type ContextPool = ReturnType<typeof createContextPool>;

let sharedPool: ContextPool | undefined;

/** Returns the page-wide shared WebGL context pool bound to the device's limit. */
export function getSharedContextPool(): ContextPool {
  if (sharedPool === undefined) {
    sharedPool = createContextPool({
      getLimit: getMaxWebGLContexts,
      isMobile: isMobileDevice,
    });
  }
  return sharedPool;
}
