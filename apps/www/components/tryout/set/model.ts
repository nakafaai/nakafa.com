import type { Ref } from "@confect/core";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import type refs from "@repo/backend/confect/_generated/refs";
import {
  publicTryoutExamValidator,
  publicTryoutSectionValidator,
  publicTryoutSetValidator,
  publicTryoutTrackValidator,
} from "@repo/backend/confect/tryouts/queries/catalogModel";
import {
  tryoutAttemptStateValidator,
  tryoutRuntimeStateValidator,
  tryoutSectionContentAccessValidator,
  tryoutSectionRuntimeValidator,
} from "@repo/backend/confect/tryouts/runtime/spec";
import { Schema, Struct } from "effect";

/** Convex query contract for the set discovery page. */
export type SetPageQuery =
  typeof refs.public.tryouts.queries.catalog.getSetPage;

const SetPageSchema = Schema.Struct({
  exam: publicTryoutExamValidator,
  entrySection: Schema.NullOr(publicTryoutSectionValidator),
  set: publicTryoutSetValidator,
  sections: Schema.Array(publicTryoutSectionValidator),
  track: publicTryoutTrackValidator,
});
/** Loaded try-out set discovery payload. */
export type SetPage = typeof SetPageSchema.Type;

const SetRestartTargetSchema = Schema.NullOr(
  Schema.Struct({
    entrySection: publicTryoutSectionValidator,
    setPublicPath: Schema.String,
  })
);

const setAttemptPageFields = {
  attemptId: IdSchema("tryoutAttempts"),
  content: tryoutSectionContentAccessValidator,
  initialState: tryoutRuntimeStateValidator,
  page: SetPageSchema,
  restartTarget: SetRestartTargetSchema,
};

/** Current or retained attempt page of one set, told apart by its kind. */
const SetAttemptPageResultSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("current"), ...setAttemptPageFields }),
  Schema.Struct({ kind: Schema.Literal("retained"), ...setAttemptPageFields }),
]);
type SetAttemptPageResult = typeof SetAttemptPageResultSchema.Type;

/** Initial mutable state carried by an exact current or retained set page. */
export type TryoutSetInitialState = SetAttemptPageResult["initialState"];

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

const TryoutSetRouteSchema = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: AppLocaleCodeSchema,
  set: Schema.String,
  track: Schema.String,
});
/** URL route coordinates for one try-out set page. */
export type TryoutSetRoute = typeof TryoutSetRouteSchema.Type;

export const TryoutSetDestinationSchema = Schema.Struct({
  href: Schema.String,
  sectionKey: Schema.String,
});
/** Section route and query identity selected for the current set action. */
export type TryoutSetDestination = typeof TryoutSetDestinationSchema.Type;

/** Verified entry and canonical set route for a new current-catalog attempt. */
export type TryoutSetRestartTarget = NonNullable<
  SetAttemptPageResult["restartTarget"]
>;

const TryoutSetViewSchema = Schema.Struct({
  actionAttempt: Schema.optionalKey(Schema.NullOr(tryoutAttemptStateValidator)),
  activeAttempt: Schema.NullOr(tryoutAttemptStateValidator),
  currentHref: Schema.String,
  entrySection: Schema.NullOr(publicTryoutSectionValidator),
  page: SetPageSchema,
  returnHref: Schema.String,
  route: TryoutSetRouteSchema,
  sectionRoutes: Schema.Array(publicTryoutSectionValidator),
  start: Schema.Struct({
    destination: Schema.NullOr(TryoutSetDestinationSchema),
    entrySection: Schema.NullOr(publicTryoutSectionValidator),
    set: publicTryoutSetValidator,
  }),
});
/** Cohesive render model shared by set overview surfaces. */
export type TryoutSetView = typeof TryoutSetViewSchema.Type;

/** Runtime states of a direct-entry set, as the render model names them. */
const TryoutInternalRuntimeStateSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("none") }),
  Schema.Struct({
    kind: Schema.Literal("active"),
    runtime: tryoutSectionRuntimeValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("pending"),
    runtime: tryoutSectionRuntimeValidator,
  }),
  Schema.Struct({
    kind: Schema.Literal("review"),
    runtime: tryoutSectionRuntimeValidator,
  }),
]);

const TryoutInternalSetViewSchema = Schema.Struct({
  ...TryoutSetViewSchema.mapFields(Struct.omit(["entrySection"])).fields,
  entrySection: publicTryoutSectionValidator,
  runtimeState: TryoutInternalRuntimeStateSchema,
});

/** Render model for sets whose only section is the set entry itself. */
export type TryoutInternalSetView = typeof TryoutInternalSetViewSchema.Type;
