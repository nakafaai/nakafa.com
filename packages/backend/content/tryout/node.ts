import type {
  CatalogCountrySchema,
  CatalogExamSchema,
  CatalogGroupSchema,
  CatalogTrackSchema,
} from "@nakafa/aksara-contracts/assessment/catalog";

type CatalogCountry = typeof CatalogCountrySchema.Type;
type CatalogExam = typeof CatalogExamSchema.Type;
type CatalogGroup = typeof CatalogGroupSchema.Type;
type CatalogTrack = typeof CatalogTrackSchema.Type;

/** The description of a catalog row, when it has one, as a public model spreads it. */
export const descriptionOf = (row: { readonly description?: string }) =>
  row.description === undefined ? {} : { description: row.description };

/** Projects one country into the public catalog contract. */
export function toPublicCountry(country: CatalogCountry) {
  return {
    countryCode: country.countryCode,
    countryKey: country.countryKey,
    ...descriptionOf(country),
    publicPath: country.publicPath,
    title: country.title,
  };
}

/** Projects one exam into the public catalog contract, with the axis that groups its tracks. */
export function toPublicExam(exam: CatalogExam) {
  return {
    ...descriptionOf(exam),
    examKey: exam.examKey,
    groupAxis: exam.groupAxis,
    publicPath: exam.publicPath,
    title: exam.title,
  };
}

/** Projects one group of an exam into the public catalog contract. */
export function toPublicGroup(group: CatalogGroup) {
  return {
    ...descriptionOf(group),
    groupKey: group.groupKey,
    publicPath: group.publicPath,
    title: group.title,
  };
}

/** Projects one track into the public catalog contract, with the group that holds it. */
export function toPublicTrack(track: CatalogTrack) {
  return {
    ...descriptionOf(track),
    groupKey: track.groupKey,
    publicPath: track.publicPath,
    title: track.title,
    trackKey: track.trackKey,
  };
}
