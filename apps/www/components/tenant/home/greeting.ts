import type { ActSchema } from "@repo/mascot/nina/act";
import { Array as Arr, DateTime, Option, Schema, String as Str } from "effect";

/** The parts of the day that a greeting names. */
const DayPartSchema = Schema.Literals(["afternoon", "evening", "morning"]);

/** One part of the day that a greeting names. */
type DayPart = typeof DayPartSchema.Type;

/** A part of the day and the hour on the school's clock at which it starts. */
const PartStart = Schema.Struct({ hour: Schema.Finite, part: DayPartSchema });

/** Where each part of the day starts, by the hour on the school's clock, earliest first. */
const PART_STARTS: readonly (typeof PartStart.Type)[] = [
  { hour: 4, part: "morning" },
  { hour: 12, part: "afternoon" },
  { hour: 18, part: "evening" },
];

/** The evening, which the hours before the morning belong to, because the day has not begun yet. */
const EVENING: DayPart = "evening";

/** The act that Nina does in each part of the day: a wave in the morning, typing in the afternoon, reading in the evening. */
export const DAY_PART_ACT: Record<DayPart, typeof ActSchema.Type> = {
  afternoon: "typing",
  evening: "reading",
  morning: "waving",
};

/**
 * The part of the day that an hour falls in. Each part runs from its start to the next one, and the
 * hours before four in the morning are the evening of the day before.
 */
export const dayPartOf = (hour: number): DayPart =>
  Option.getOrElse(
    Option.map(
      Arr.findLast(PART_STARTS, (start) => hour >= start.hour),
      (start) => start.part
    ),
    () => EVENING
  );

/**
 * The part of the day at an instant on the clock of a zone. A school with no unit has no zone of its
 * own, so its greeting reads the instant on the UTC clock.
 */
export const dayPartAt = (
  now: DateTime.Utc,
  zone: Option.Option<DateTime.TimeZone.Named>
): DayPart => {
  const local = Option.match(zone, {
    onNone: () => now,
    onSome: (named) => DateTime.setZone(now, named),
  });
  return dayPartOf(DateTime.toParts(local).hour);
};

/** The runs of white space that separate the words of a name. */
const WORD_GAP = /\s+/u;

/** The first name of a person, which is the first word of the name the school holds for them. */
export const firstNameOf = (name: string) =>
  Arr.headNonEmpty(Str.split(WORD_GAP)(Str.trim(name)));
