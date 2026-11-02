import type { SwitchedOff } from "@repo/backend/confect/notifications/preference";
import {
  canSwitchOff,
  NoticeKind,
  type Relation,
  routeOf,
} from "@repo/backend/confect/notifications/rules";
import { Array as Arr, Option, Result } from "effect";

/** Whether a person gets a kind on a channel at all, and may switch it off. A mail the poster chooses is not theirs to choose. */
const switchable = (
  kind: typeof NoticeKind.Type,
  relation: typeof Relation.Type,
  channel: "email" | "push"
) =>
  canSwitchOff(kind, channel) &&
  Option.exists(routeOf(kind, relation), (route) =>
    Arr.some(route[channel] ?? [], (timing) => timing._tag !== "Chosen")
  );

/** Each kind a relation receives, with the channels that person can switch off, and no row for a kind with none. */
export const preferenceRowsOf = (relation: typeof Relation.Type) =>
  Arr.filterMap(NoticeKind.literals, (kind) => {
    const channels = Arr.filter(["push", "email"] as const, (channel) =>
      switchable(kind, relation, channel)
    );
    return Arr.isReadonlyArrayEmpty(channels)
      ? Result.failVoid
      : Result.succeed({ channels, kind });
  });

/**
 * Each kind a relation receives, with the channels this reader keeps on. The choice lives in the row, because a table
 * keeps the accessors of its first columns, so a column that asked `off` itself would show the first answer for good.
 */
export const preferenceChoicesOf = (
  relation: typeof Relation.Type,
  off: readonly (typeof SwitchedOff.Type)[]
) =>
  Arr.map(preferenceRowsOf(relation), (row) => ({
    ...row,
    on: Arr.filter(
      row.channels,
      (channel) =>
        !Arr.some(
          off,
          (choice) => choice.kind === row.kind && choice.channel === channel
        )
    ),
  }));

/** The relation a School role reads its notices as. */
export const relationOfRole = (role: string): typeof Relation.Type => {
  if (role === "student" || role === "guardian") {
    return role;
  }
  return "teacher";
};
