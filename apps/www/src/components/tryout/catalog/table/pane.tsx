import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Array as Arr, Option } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { ClockProvider } from "@/components/player/now";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
} from "@/components/shared/page/pane";
import { usePanes } from "@/components/shared/page/panes";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";
import { TryoutLevelBadge } from "@/components/tryout/level";
import {
  TryoutPressProvider,
  TryoutStartProvider,
} from "@/components/tryout/runtime/start";
import { TryoutSectionRows } from "@/components/tryout/set/rows";
import type { StartTryoutRequest } from "@/components/tryout/set/start";
import { StartTryoutButton } from "@/components/tryout/set/start";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * The open set of a track, beside its table: a press on the row of a set the learner has not started opens it
 * here (the owner's sketch "pane baru kebuka", for a set not yet started). Its header names the set over what it says of
 * itself, its body shows the set's facts in their card and its parts in the set page's own list, and its
 * footer shows its level and starts
 * it through the start's dialog, which asks Latihan or Simulasi. A set the learner has started opens its own page
 * instead, so its row never opens this pane.
 */
export function TryoutSetPane({ rows }: { rows: readonly TryoutSetRow[] }) {
  const open = usePanes((state) => state.open);
  const row = Option.flatMap(open, (publicPath) =>
    Arr.findFirst(rows, (set) => set.publicPath === publicPath)
  );

  if (Option.isNone(row)) {
    return null;
  }

  return <TryoutSetDetail row={row.value} />;
}

/** The detail of one open set: its header, its facts and parts, and its start. */
function TryoutSetDetail({ row }: { row: TryoutSetRow }) {
  const t = useTranslations("Tryouts");
  const tCommon = useTranslations("Common");
  const minutes = row.durationSeconds / 60;

  return (
    <>
      <PaneHeader
        description={
          row.description ??
          t("set-pane-sections", { count: row.sections.length })
        }
        title={row.title}
      />
      <PaneBody>
        <div className="flex flex-col gap-4">
          <Card size="sm">
            <CardContent>
              <PaneFacts layout="grid">
                <PaneFact label={tCommon("exam-questions")}>
                  {row.questionCount}
                </PaneFact>
                <PaneFact label={t("set-column-duration")}>
                  {t("set-duration-minutes", { minutes })}
                </PaneFact>
              </PaneFacts>
            </CardContent>
          </Card>
          {/* The set page's own list of parts, the one list card every try-out list draws. */}
          <TryoutSectionRows sections={row.sections} />
        </div>
      </PaneBody>
      <PaneFooter>
        {/* The set's measured level, at the footer's start: a badge never sits in a title (owner, 15 Nov 2026). */}
        <span className="me-auto">
          <TryoutLevelBadge level={row.level} />
        </span>
        {/* A learner's Start reads the try-out clock, as the set page's does, so the pane gives it one. */}
        <ClockProvider>
          <TryoutPressProvider>
            <TryoutStartProvider>
              <TryoutSetStart row={row} />
            </TryoutStartProvider>
          </TryoutPressProvider>
        </ClockProvider>
      </PaneFooter>
    </>
  );
}

/**
 * Starts the open set as its own page does: through the start's dialog, which asks Latihan or Simulasi, into the
 * section the set enters. A visitor's press goes to sign in and comes back to the set's page.
 */
function TryoutSetStart({ row }: { row: TryoutSetRow }) {
  const locale = useLocale();
  if (!isActiveLocale(locale)) {
    return null;
  }
  const entry = row.entrySection;
  const internal = entry.visibility === "internal-entry";
  const request: StartTryoutRequest = {
    authRedirect: { publicPath: row.publicPath },
    countryKey: row.countryKey,
    destination: { publicPath: entry.publicPath ?? row.publicPath },
    ...(internal
      ? { entrySectionKey: entry.sectionKey }
      : { destinationSectionKey: entry.sectionKey }),
    examKey: row.examKey,
    locale,
    setKey: row.setKey,
    setPath: row.publicPath,
    successNavigation: "destination",
    trackKey: row.trackKey,
  };

  return <StartTryoutButton attempt={null} request={request} />;
}
