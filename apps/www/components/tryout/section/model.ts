import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type PublicSectionPage = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.catalog.getSectionPage>
>;

type RetainedSectionAttemptPage = Extract<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.attemptPage.getSection>
  >,
  { kind: "retained" }
>;

type RetainedSectionPage = RetainedSectionAttemptPage["page"];

/** Initial mutable state carried by one exact retained section page. */
export type TryoutSectionInitialState =
  RetainedSectionAttemptPage["initialState"];

/** Public or exact frozen page rendered by one section route. */
export type TryoutSectionPage = PublicSectionPage | RetainedSectionPage;
