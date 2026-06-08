import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

export type RuntimeArticlePage = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getArticlePage>
>;
export type RuntimeSubjectPage = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getSubjectPage>
>;
export type RuntimeMdxPage = RuntimeArticlePage | RuntimeSubjectPage;
export type RuntimeContentRoutePage = FunctionReturnType<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>;
export type RuntimeQuranSurahPage = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getQuranSurahPage>
>;
export type RuntimeQuranSurah = RuntimeQuranSurahPage["surahData"];
export type RuntimeContentSection = FunctionArgs<
  typeof api.contents.queries.runtime.listContentRoutesByPrefix
>["section"];
