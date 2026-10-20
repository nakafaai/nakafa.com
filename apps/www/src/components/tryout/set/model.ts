import type { Ref } from "@confect/core";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";

import { Schema } from "effect";

/** Convex query contract for the set discovery page. */
type SetPageQuery = typeof tryouts.queries.catalog.getSetPage;

type SetAttemptPageResult = Extract<
  NonNullable<Ref.Returns<typeof tryouts.queries.attemptPage.getSet>>,
  { kind: "current" | "retained" }
>;

/** Initial mutable state carried by an exact current or retained set page. */
export type TryoutSetInitialState = SetAttemptPageResult["initialState"];

/** Loaded try-out set discovery payload. */
export type SetPage =
  | NonNullable<Ref.Returns<SetPageQuery>>
  | SetAttemptPageResult["page"];

/** Internal section used by direct-entry sets. */
export type SetEntrySection = NonNullable<SetPage["entrySection"]>;

/** Current attempt payload returned by Convex. */
export type CurrentAttempt = NonNullable<
  Ref.Returns<typeof tryouts.queries.runtime.getSetAttemptState>
>["attempt"];

/** Loaded section runtime payload after null checks. */
export type LoadedRuntime = NonNullable<
  NonNullable<
    Ref.Returns<typeof tryouts.queries.runtime.getSetAttemptState>
  >["runtime"]
>;

const TryoutSetRouteSchema = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: AppLocaleCodeSchema,
  set: Schema.String,
  track: Schema.String,
});

/** URL route coordinates for one try-out set page. */
export type TryoutSetRoute = typeof TryoutSetRouteSchema.Type;

const TryoutSetDestinationSchema = Schema.Struct({
  href: Schema.String,
  sectionKey: Schema.String,
});

/** Section route and query identity selected for the current set action. */
export type TryoutSetDestination = typeof TryoutSetDestinationSchema.Type;

/** Verified entry and canonical set route for a new current-catalog attempt. */
export type TryoutSetRestartTarget = NonNullable<
  SetAttemptPageResult["restartTarget"]
>;
