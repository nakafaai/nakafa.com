import { DateTime } from "effect";

/** Return the current academic year using a July school-year rollover. */
export function getCurrentAcademicYear() {
  const date = DateTime.toDate(DateTime.nowUnsafe());
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();
  const startYear = currentMonth >= 6 ? currentYear : currentYear - 1;

  return `${startYear}/${startYear + 1}`;
}

/** Return a small academic-year chooser centered around the current year. */
export function getAcademicYearList() {
  const date = DateTime.toDate(DateTime.nowUnsafe());
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();
  const startYear = currentMonth >= 6 ? currentYear : currentYear - 1;

  return Array.from({ length: 5 }, (_, index) => {
    const year = startYear - 2 + index;

    return `${year}/${year + 1}`;
  });
}
