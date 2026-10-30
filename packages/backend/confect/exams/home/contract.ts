import { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { Schema } from "effect";

/**
 * The wire contract of the school home's exam read. A spec imports it, so this module holds
 * declarations only: no database read and no write.
 */

/**
 * What the school home shows a viewer about exams: the rooms the viewer may watch that run now, and the
 * rooms that open within the next day. A viewer who watches no room gets two empty lists.
 */
export const HomeView = Schema.Struct({
  live: Schema.Array(SittingView),
  next: Schema.Array(SittingView),
});
