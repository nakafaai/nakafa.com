import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

import { Schema } from "effect";
import type { Locale } from "next-intl";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";

/** Convex query contract for the set discovery page. */
type SetPageQuery = typeof refs.public.tryouts.queries.catalog.getSetPage;

type SetAttemptPageResult = Extract<
  NonNullable<
    Ref.Returns<typeof refs.public.tryouts.queries.attemptPage.getSet>
  >,
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
  Ref.Returns<typeof refs.public.tryouts.queries.runtime.getSetAttemptState>
>["attempt"];

/** Loaded section runtime payload after null checks. */
export type LoadedRuntime = NonNullable<
  NonNullable<
    Ref.Returns<typeof refs.public.tryouts.queries.runtime.getSetAttemptState>
  >["runtime"]
>;

/** URL route coordinates for one try-out set page. */
export interface TryoutSetRoute {
  country: string;
  exam: string;
  locale: Locale;
  set: string;
  track: string;
}

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

/** Cohesive render model shared by set overview surfaces. */
export interface TryoutSetView {
  actionAttempt?: CurrentAttempt | null;
  activeAttempt: CurrentAttempt | null;
  currentHref: string;
  entrySection: SetEntrySection | null;
  page: SetPage;
  returnHref: string;
  route: TryoutSetRoute;
  sectionRoutes: readonly SetPage["sections"][number][];
  start: {
    destination: TryoutSetDestination | null;
    entrySection: SetEntrySection | null;
    set: SetPage["set"];
  };
}

/** Render model for sets whose only section is the set entry itself. */
export interface TryoutInternalSetView extends TryoutSetView {
  entrySection: SetEntrySection;
  runtimeState: TryoutRuntimeState<LoadedRuntime>;
}
