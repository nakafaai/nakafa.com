import {
  Array as Arr,
  Effect,
  FileSystem,
  Option,
  Predicate,
  Schema,
  String as Str,
} from "effect";

/**
 * Where a heartbeat reads the container. These are the Linux paths on the
 * builder; every reading is optional because a developer machine lacks them.
 */
export const HEARTBEAT_SOURCES = {
  cgroupDirectory: "/sys/fs/cgroup",
  loadAverageFile: "/proc/loadavg",
};

/** A cgroup limit: `max` for no limit, otherwise a byte count. */
const CgroupLimit = Schema.Union([
  Schema.Literal("max"),
  Schema.FiniteFromString,
]);

const Memory = Schema.Struct({
  current: Schema.Finite,
  high: CgroupLimit,
  max: CgroupLimit,
});
type Memory = typeof Memory.Type;

/** One heartbeat. An unavailable reading is `None`, never a made-up value. */
export const Heartbeat = Schema.Struct({
  load: Schema.Option(Schema.String),
  memory: Schema.Option(Memory),
  pressure: Schema.Option(Schema.String),
  silentSeconds: Schema.Finite,
});
export type Heartbeat = typeof Heartbeat.Type;

const decodeBytes = Schema.decodeUnknownOption(Schema.FiniteFromString);
const decodeLimit = Schema.decodeUnknownOption(CgroupLimit);

/** Reads one file as trimmed text, or none when it is missing, unreadable, or empty. */
const readText = Effect.fn("BuildHeartbeat.readText")(function* (path: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const text = yield* Effect.option(fileSystem.readFileString(path));
  return Option.filter(Option.map(text, Str.trim), Str.isNonEmpty);
});

/** Keeps the three load averages from `/proc/loadavg` and drops the process counts. */
function loadAverages(text: string) {
  return Arr.join(Arr.take(Str.split(text, " "), 3), " ");
}

/** Joins the lines of a pressure stall file into one line. */
function pressureLine(text: string) {
  return Arr.join(Str.split(text, "\n"), " | ");
}

/** Reads what the container exposes right now, after `silentSeconds` of build silence. */
export const readHeartbeat = Effect.fn("BuildHeartbeat.read")(function* (
  sources: typeof HEARTBEAT_SOURCES,
  silentSeconds: number
) {
  const directory = sources.cgroupDirectory;
  const [current, high, max, pressure, load] = yield* Effect.all([
    readText(`${directory}/memory.current`),
    readText(`${directory}/memory.high`),
    readText(`${directory}/memory.max`),
    readText(`${directory}/memory.pressure`),
    readText(sources.loadAverageFile),
  ]);
  return {
    load: Option.map(load, loadAverages),
    memory: Option.all({
      current: Option.flatMap(current, decodeBytes),
      high: Option.flatMap(high, decodeLimit),
      max: Option.flatMap(max, decodeLimit),
    }),
    pressure: Option.map(pressure, pressureLine),
    silentSeconds,
  };
});

/** Formats a byte count in mebibytes, rounded to whole MiB. */
function formatMebibytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MiB`;
}

/** Formats one cgroup limit; `max` stays as the kernel writes it. */
function formatLimit(limit: Memory["high"]) {
  return Predicate.isNumber(limit) ? formatMebibytes(limit) : limit;
}

function formatMemory({ current, high, max }: Memory) {
  return `${formatMebibytes(current)}, high ${formatLimit(high)}, max ${formatLimit(max)}`;
}

/** Renders one heartbeat as a single line that starts with `build heartbeat:`. */
export function formatHeartbeat(heartbeat: Heartbeat) {
  return Arr.join(
    [
      `build heartbeat: silent ${heartbeat.silentSeconds}s`,
      `memory ${Option.match(heartbeat.memory, {
        onNone: () => "unavailable",
        onSome: formatMemory,
      })}`,
      `pressure ${Option.getOrElse(heartbeat.pressure, () => "unavailable")}`,
      `load ${Option.getOrElse(heartbeat.load, () => "unavailable")}`,
    ],
    "; "
  );
}
