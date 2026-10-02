import type { Ref } from "@confect/core";
import { AppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type refs from "@repo/backend/confect/_generated/refs";
import { Schema } from "effect";

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

/** URL route coordinates for one try-out section page. */
const TryoutSectionRouteSchema = Schema.Struct({
  country: Schema.String,
  exam: Schema.String,
  locale: AppLocaleCodeSchema,
  section: Schema.String,
  set: Schema.String,
  track: Schema.String,
});

/** URL route coordinates for one try-out section page. */
export type TryoutSectionRoute = typeof TryoutSectionRouteSchema.Type;
