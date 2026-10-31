import { Calendar03Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { PublicationDates } from "@nakafa/aksara-contracts/date";
import { AvatarGroup } from "@repo/design-system/components/ui/avatar";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { forSeed } from "@repo/mascot/seed";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useTranslations } from "use-intl";

/**
 * Says who wrote a lesson or an article and when, under its title, so a reader
 * and a search engine read the same names and dates as the structured data. The
 * authors stand on the left, each with their animal, and the dates on the right.
 * On a narrow screen the dates take a row of their own.
 */
export function ContentByline({
  authors,
  dateModified,
  datePublished,
}: PublicationDates & { authors: readonly { readonly name: string }[] }) {
  const tCommon = useTranslations("Common");

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <AvatarGroup>
          {Arr.map(authors, ({ name }) => (
            <PersonAvatar key={name} mascot={forSeed(name)} size="sm" />
          ))}
        </AvatarGroup>
        <p className="min-w-0 font-medium text-pretty">
          {Arr.join(
            Arr.map(authors, ({ name }) => name),
            ", "
          )}
        </p>
      </div>
      <dl className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
        <ContentDate
          date={datePublished}
          icon={Calendar03Icon}
          label={tCommon("published")}
        />
        {dateModified && dateModified !== datePublished ? (
          <ContentDate
            date={dateModified}
            icon={PencilEdit02Icon}
            label={tCommon("updated")}
          />
        ) : null}
      </dl>
    </div>
  );
}

/**
 * One date of a byline. The icon shows which date it is, and the label names it
 * for a screen reader and, as the title, for a pointer resting on it.
 */
function ContentDate({
  date,
  icon,
  label,
}: {
  date: string;
  icon: IconSvgElement;
  label: string;
}) {
  const formatter = useFormatter();
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <dt className="sr-only">{label}</dt>
      <HugeIcons aria-hidden="true" className="size-4" icon={icon} />
      <dd>
        <time className="tabular-nums" dateTime={date}>
          {formatter.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(`${date}T00:00:00.000Z`)),
            {
              dateStyle: "medium",
              timeZone: "UTC",
            }
          )}
        </time>
      </dd>
    </div>
  );
}
