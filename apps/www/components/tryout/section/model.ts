import type { Ref } from "@confect/core";
import type refs from "@repo/backend/confect/_generated/refs";

type PublicSectionPage = NonNullable<
  Ref.Returns<typeof refs.public.tryouts.queries.catalog.getSectionPage>
>;

type RetainedSectionAttemptPage = Extract<
  NonNullable<
    Ref.Returns<typeof refs.public.tryouts.queries.attemptPage.getSection>
  >,
  { kind: "retained" }
>;

type RetainedSectionPage = RetainedSectionAttemptPage["page"];

/** Initial mutable state carried by one exact retained section page. */
export type TryoutSectionInitialState =
  RetainedSectionAttemptPage["initialState"];

/** Public or exact frozen page rendered by one section route. */
export type TryoutSectionPage = PublicSectionPage | RetainedSectionPage;
