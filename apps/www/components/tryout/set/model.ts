import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import type { TryoutQuestionContent } from "@/components/tryout/content/load";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";

/** Convex query contract for the set discovery page. */
export type SetPageQuery = typeof api.tryouts.queries.catalog.getSetPage;

/** Loaded try-out set discovery payload. */
export type SetPage = NonNullable<FunctionReturnType<SetPageQuery>>;

/** Internal section used by direct-entry sets. */
export type SetEntrySection = NonNullable<SetPage["entrySection"]>;

/** Current attempt payload returned by Convex. */
export type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

/** Convex query contract for the current set attempt. */
export type CurrentAttemptQuery = typeof api.tryouts.queries.attempt.getCurrent;

/** Convex query contract for one direct-entry runtime. */
export type SectionRuntimeQuery =
  typeof api.tryouts.queries.attempt.getSectionRuntime;

/** Loaded section runtime payload after null checks. */
export type LoadedRuntime = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.attempt.getSectionRuntime>
>;

/** Static MDX content needed by a direct-entry runtime. */
export interface TryoutSetContent {
  entryQuestions: readonly TryoutQuestionContent[];
}

/** Server-preloaded reactive state needed by one set route. */
export interface TryoutSetPreloads {
  attempt: Preloaded<CurrentAttemptQuery>;
  page: Preloaded<SetPageQuery>;
  runtime: Preloaded<SectionRuntimeQuery> | null;
}

/** URL route coordinates for one try-out set page. */
export interface TryoutSetRoute {
  country: string;
  exam: string;
  locale: Locale;
  set: string;
  track: string;
}

/** Cohesive render model shared by set overview surfaces. */
export interface TryoutSetView {
  actionAttempt?: CurrentAttempt;
  activeAttempt: NonNullable<CurrentAttempt> | null;
  entryHref: string;
  entrySection: SetEntrySection | null;
  page: SetPage;
  route: TryoutSetRoute;
}

/** Render model for sets whose only section is the set entry itself. */
export interface TryoutInternalSetView extends TryoutSetView {
  content: TryoutSetContent;
  entrySection: SetEntrySection;
  runtimeState: TryoutRuntimeState<LoadedRuntime>;
}
