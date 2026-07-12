import type { api } from "@repo/backend/convex/_generated/api";
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

/** Loaded section runtime payload after null checks. */
export type LoadedRuntime = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.attempt.getSectionRuntime>
>;

/** Static MDX content needed by a direct-entry runtime. */
export interface TryoutSetContent {
  entryQuestions: readonly TryoutQuestionContent[];
}

/** URL route coordinates for one try-out set page. */
export interface TryoutSetRoute {
  country: string;
  exam: string;
  locale: Locale;
  set: string;
  track: string;
}

/** Section route and query identity selected for the current set action. */
export interface TryoutSetDestination {
  href: string;
  sectionKey: string;
}

/** Cohesive render model shared by set overview surfaces. */
export interface TryoutSetView {
  actionAttempt?: CurrentAttempt;
  activeAttempt: NonNullable<CurrentAttempt> | null;
  destination: TryoutSetDestination | null;
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
