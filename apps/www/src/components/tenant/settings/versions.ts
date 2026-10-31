import type {
  OptimisticLocalStore,
  OptimisticUpdate,
  PaginatedQueryItem,
} from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import {
  Band,
  GradeValue,
  type GradingScheme,
  normalizeScheme,
} from "@repo/backend/confect/records/scheme";
import { Array as Arr, Option, Schema, String as Str } from "effect";
import { createContext } from "react";
import { draftText, isFirstPage } from "@/components/tenant/settings/state";

/** One stored version of the school's grading scheme, as the grading page lists it. */
export type SchemeVersion = PaginatedQueryItem<typeof records.schemes.list>;

/**
 * What the scheme's form holds while an Admin writes a version: its KKTP and its bands as the fields hold them, each
 * band with a key of its own, so a row keeps its fields when another row is removed.
 */
export const SchemeDraft = Schema.Struct({
  bands: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      label: Schema.String,
      minimum: Schema.NullOr(Schema.Finite),
    })
  ),
  kktp: Schema.NullOr(Schema.Finite),
});

/** The form of a new version, filled in with the scheme it follows: its KKTP and its bands, in order. */
export const draftOfScheme = (
  scheme: GradingScheme
): typeof SchemeDraft.Type => ({
  bands: Arr.map(normalizeScheme(scheme).bands, (band, index) => ({
    key: `band-${index}`,
    label: band.label,
    minimum: band.minimum,
  })),
  kktp: scheme.kktp,
});

/**
 * The scheme a form names once every field holds what the server accepts: a KKTP on the scale, and each band's
 * trimmed label with its minimum on the scale. None while any field does not.
 */
export const checkedScheme = (draft: typeof SchemeDraft.Type) =>
  Option.map(
    Option.all({
      bands: Option.all(
        Arr.map(draft.bands, (band) =>
          Schema.decodeUnknownOption(Band)({
            label: Str.trim(band.label),
            minimum: band.minimum,
          })
        )
      ),
      kktp: Option.liftPredicate(draft.kktp, Schema.is(GradeValue)),
    }),
    (scheme): GradingScheme => normalizeScheme(scheme)
  );

/**
 * When a new version takes effect: now, or just after the newest stored version when that one is dated later, since
 * the server keeps only a version that follows the newest.
 */
export const nextEffectiveFrom = (
  now: number,
  newest: Option.Option<SchemeVersion>
) =>
  Option.match(newest, {
    onNone: () => now,
    onSome: (version) => Math.max(now, version.effectiveFrom + 1),
  });

/**
 * Lists a stored version at once, first on the first page of the school's versions, as the version in force. Its
 * ID is a draft until the server answers.
 */
export const storeSchemeChange: OptimisticUpdate<
  typeof records.schemes.store
> = (localStore, { bands, effectiveFrom, kktp, slug }) => {
  const draft: SchemeVersion = {
    ...normalizeScheme({ bands, kktp }),
    effectiveFrom,
    id: Schema.decodeUnknownSync(Id("gradingSchemes"))(draftText()),
    used: false,
  };
  for (const query of localStore.getAllQueries(records.schemes.list)) {
    if (
      Option.isSome(query.value) &&
      query.args.slug === slug &&
      isFirstPage(query.args)
    ) {
      localStore.setQuery(
        records.schemes.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: Arr.prepend(query.value.value.page, draft),
        })
      );
    }
  }
};

/**
 * The versions as the grading page has read them: whether they are read, and the newest one, the version in force,
 * if the school has stored any. The page provides it, and New version and its dialog read it.
 */
export const SchemeVersionsContext = createContext<{
  newest: Option.Option<SchemeVersion>;
  ready: boolean;
}>({ newest: Option.none(), ready: false });

/** Replaces the versions of a school in every page the store holds. */
const changeVersions = (
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  slug: string,
  change: (page: readonly SchemeVersion[]) => readonly SchemeVersion[]
) => {
  for (const query of localStore.getAllQueries(records.schemes.list)) {
    if (Option.isSome(query.value) && query.args.slug === slug) {
      localStore.setQuery(
        records.schemes.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
};

/** Shows a corrected version at once. */
export const amendSchemeChange: OptimisticUpdate<
  typeof records.schemes.amend
> = (localStore, { bands, kktp, schemeId, slug }) => {
  const scheme = normalizeScheme({ bands, kktp });
  changeVersions(localStore, slug, (page) =>
    Arr.map(page, (version) =>
      version.id === schemeId ? { ...version, ...scheme } : version
    )
  );
};

/** Takes a removed version out of the list at once. */
export const removeSchemeChange: OptimisticUpdate<
  typeof records.schemes.remove
> = (localStore, { schemeId, slug }) => {
  changeVersions(localStore, slug, (page) =>
    Arr.filter(page, (version) => version.id !== schemeId)
  );
};
