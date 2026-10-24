import { Array as Arr, DateTime, Option, Schema } from "effect";

/**
 * The days that the schedule shows: today and the fourteen days after it. A room the home lists opens within those
 * fourteen days, so every room has its column.
 */
export const SCHEDULE_DAYS = 15;

/** A room as the schedule places it: its opening, and the time zone of its unit, which decides its day. */
const ScheduledRoom = Schema.Struct({
  opensAt: Schema.Finite,
  timeZone: Schema.String,
});

/** A room as the schedule places it, with the type of its schema. */
type ScheduledRoom = typeof ScheduledRoom.Type;

/** One room that the schedule draws: where its bar leads, and the name that its bar reads with. */
export const ScheduleRoom = Schema.Struct({
  ...ScheduledRoom.fields,
  id: Schema.String,
  room: Schema.String,
  title: Schema.String,
});

/** One room that the schedule draws, with the type of its schema. */
export type ScheduleRoom = typeof ScheduleRoom.Type;

/** One column of the schedule: its day of the month, whether it is today, and the rooms that open on that day. */
export interface ScheduleDay<Room extends ScheduledRoom> {
  readonly day: number;
  readonly key: string;
  readonly rooms: readonly Room[];
  readonly today: boolean;
}

/** The calendar day of a room on its unit's clock, such as "2026-10-24". */
const dayOf = (room: ScheduledRoom) =>
  Option.map(DateTime.zoneMakeNamed(room.timeZone), (zone) =>
    DateTime.formatIsoDate(
      DateTime.setZone(DateTime.makeUnsafe(room.opensAt), zone)
    )
  );

/**
 * The columns of the schedule from today, on the clock of the first room's unit, with each room in the column of its
 * own day. A school's units share one time zone in practice, so the first room's zone reads the calendar. A list with
 * no room has no columns, and the schedule is then left out.
 */
export const scheduleDays = <Room extends ScheduledRoom>(
  rooms: readonly Room[],
  now: number
): readonly ScheduleDay<Room>[] =>
  Option.match(
    Option.flatMap(Arr.head(rooms), (room) =>
      DateTime.zoneMakeNamed(room.timeZone)
    ),
    {
      onNone: () => [],
      onSome: (zone) => {
        const today = DateTime.setZone(DateTime.makeUnsafe(now), zone);
        return Arr.makeBy(SCHEDULE_DAYS, (index) => {
          const date = DateTime.add(today, { days: index });
          const key = DateTime.formatIsoDate(date);
          return {
            day: DateTime.toParts(date).day,
            key,
            rooms: Arr.filter(rooms, (room) =>
              Option.exists(dayOf(room), (roomDay) => roomDay === key)
            ),
            today: index === 0,
          };
        });
      },
    }
  );
