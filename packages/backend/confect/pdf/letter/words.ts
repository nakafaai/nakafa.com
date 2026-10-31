/** The months as an Indonesian date names them. */
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** A calendar date `YYYY-MM-DD` as an Indonesian date writes it: `4 Mei 2026`. */
export const indonesianDate = (date: string) =>
  `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** A transcript value as Indonesian numbers write it: two decimals after a comma, `85,75`. */
export const indonesianValue = (value: number) =>
  value.toFixed(2).replace(".", ",");
