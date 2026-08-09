import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type PublicSectionPage = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.catalog.getSectionPage>
>;

type RetainedSectionPage = Extract<
  NonNullable<
    FunctionReturnType<typeof api.tryouts.queries.attemptPage.getSection>
  >,
  { kind: "retained" }
>["page"];

/** Public or exact frozen page rendered by one section route. */
export type TryoutSectionPage = PublicSectionPage | RetainedSectionPage;
