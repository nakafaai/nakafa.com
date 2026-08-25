import type { PublicationDates } from "@nakafa/aksara-contracts/date";
import { getFormatter, getTranslations } from "next-intl/server";

/** Provides truthful publication semantics without changing visual layout. */
export async function ContentDates({
  dateModified,
  datePublished,
}: PublicationDates) {
  const [formatter, tCommon] = await Promise.all([
    getFormatter(),
    getTranslations("Common"),
  ]);
  const formatDate = (date: string) =>
    formatter.dateTime(new Date(`${date}T00:00:00.000Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  return (
    <p className="sr-only">
      {tCommon("published")}:{" "}
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
