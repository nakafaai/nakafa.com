import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";

/** Convex query contract for the set discovery page. */
export type SetPageQuery = typeof api.tryouts.queries.catalog.getSetPage;

type SetAttemptPageResult = Extract<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.attemptPage.getSet>
  >,
  { kind: "current" | "retained" }
>;

/** Initial mutable state carried by an exact current or retained set page. */
export type TryoutSetInitialState = SetAttemptPageResult["initialState"];

/** Loaded try-out set discovery payload. */
export type SetPage =
  | NonNullable<FunctionReturnType<SetPageQuery>>
  | SetAttemptPageResult["page"];

/** Internal section used by direct-entry sets. */
export type SetEntrySection = NonNullable<SetPage["entrySection"]>;

/** Current attempt payload returned by Convex. */
export type CurrentAttempt = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.runtime.getSetAttemptState>
>["attempt"];

/** Loaded section runtime payload after null checks. */
export type LoadedRuntime = NonNullable<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.runtime.getSetAttemptState>
  >["runtime"]
>;

/** Static MDX content needed by a direct-entry runtime. */
export interface TryoutSetContent {
  entryAnswers: readonly TryoutAnswerContent[];
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
  content: TryoutSetContent;
  entrySection: SetEntrySection;
  runtimeState: TryoutRuntimeState<LoadedRuntime>;
}
