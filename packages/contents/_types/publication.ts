import type { DateOnly } from "@nakafa/aksara-contracts/date";

interface LegacyDates<Date extends string> {
  readonly date: Date;
  readonly dateModified?: never;
  readonly datePublished?: never;
}

interface CurrentDates<Date extends string> {
  readonly date?: never;
  readonly dateModified?: Date;
  readonly datePublished: Date;
}

/** Exact signed date shapes accepted only during the 0.15.1 cutover. */
export type ProjectionDates<Date extends string = DateOnly> =
  | LegacyDates<Date>
  | CurrentDates<Date>;

/** Current public date model produced from a decoded transition shape. */
export interface NormalizedDates<Date extends string = DateOnly> {
  readonly dateModified?: Date;
  readonly datePublished: Date;
}

/** Narrows the exact transition union without accepting explicit undefined. */
function hasLegacyDate<Date extends string>(
  dates: ProjectionDates<Date>
): dates is LegacyDates<Date> {
  return typeof dates.date === "string";
}

/** Normalizes one decoded signed projection into Nakafa's current date model. */
export function normalizePublicationDates<const Date extends string>(
  dates: ProjectionDates<Date>
): NormalizedDates<Date> {
  if (hasLegacyDate(dates)) {
    return { datePublished: dates.date };
  }

  if (dates.dateModified === undefined) {
    return { datePublished: dates.datePublished };
  }

  return {
    dateModified: dates.dateModified,
    datePublished: dates.datePublished,
  };
}

/** Orders transition rows by truthful publication date and stable identity. */
export function comparePublicationDates<
  const Date extends string,
  const Content extends ProjectionDates<Date> & {
    readonly contentKey: string;
  },
>(left: Content, right: Content) {
  const leftDates = normalizePublicationDates(left);
  const rightDates = normalizePublicationDates(right);
  const dateOrder = rightDates.datePublished.localeCompare(
    leftDates.datePublished
  );

  if (dateOrder !== 0) {
    return dateOrder;
  }

  return right.contentKey.localeCompare(left.contentKey);
}
