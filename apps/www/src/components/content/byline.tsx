import type { PublicationDates } from "@nakafa/aksara-contracts/date";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useTranslations } from "use-intl";

/**
 * Says who wrote a lesson or an article and when, under its title, so a reader
 * and a search engine read the same names and dates as the structured data.
 */
export function ContentByline({
  authors,
  dateModified,
  datePublished,
}: PublicationDates & { authors: readonly { readonly name: string }[] }) {
  const formatter = useFormatter();
  const tCommon = useTranslations("Common");
  const formatDate = (date: string) =>
    formatter.dateTime(
      DateTime.toDateUtc(DateTime.makeUnsafe(`${date}T00:00:00.000Z`)),
      {
        dateStyle: "medium",
        timeZone: "UTC",
      }
    );

  return (
    <p className="text-muted-foreground text-sm text-pretty">
      {Arr.join(
        Arr.map(authors, ({ name }) => name),
        ", "
      )}
      . {tCommon("published")}:{" "}
      <time dateTime={datePublished}>{formatDate(datePublished)}</time>.
      {dateModified ? (
        <>
          {" "}
          {tCommon("updated")}:{" "}
          <time dateTime={dateModified}>{formatDate(dateModified)}</time>.
        </>
      ) : null}
    </p>
  );
}
