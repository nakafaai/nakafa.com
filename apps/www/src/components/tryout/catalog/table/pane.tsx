import { TileIcon } from "@repo/design-system/components/ui/tile";
import { getTileLooks, type TileLook } from "@repo/design-system/lib/look";
import { Array as Arr, Option, Tuple } from "effect";
import { useLocale, useTranslations } from "use-intl";
import { CatalogCardTile } from "@/components/shared/catalog/card";
import { PaneBody, PaneFooter, PaneHeader } from "@/components/shared/pane";
import { usePanes } from "@/components/shared/panes";
import {
  getTryoutExamIcons,
  getTryoutSubjectIcons,
} from "@/components/tryout/catalog/icons";
import type { TryoutSetRow } from "@/components/tryout/catalog/table/types";
import { TryoutPageLink } from "@/components/tryout/route/link";
import {
  TryoutPressProvider,
  TryoutStartProvider,
} from "@/components/tryout/runtime/start";
import {
  StartTryoutButton,
  type StartTryoutRequest,
} from "@/components/tryout/set/start";
import { isActiveLocale } from "@/lib/i18n/active";

/**
 * The open set of a track, beside its table: a press on the row of a set the learner has not started opens it
 * here (the owner's sketch IMG_1029). Its header names the set, its body shows the set's tile with its facts and
 * the parts it holds, and its footer starts it through the start's dialog, which asks Latihan or Simulasi. A set
 * the learner has started opens its own page instead, so its row never opens this pane.
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

/** The detail of one open set: its header, its tile and parts, and its start. */
function TryoutSetDetail({ row }: { row: TryoutSetRow }) {
  const t = useTranslations("Tryouts");
  const minutes = row.durationSeconds / 60;

  return (
    <>
      <PaneHeader
        description={t("set-pane-facts", {
          minutes,
          questions: row.questionCount,
        })}
        title={row.title}
      />
      <PaneBody>
        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-xl border">
            {Arr.map(
              getTileLooks([
                Tuple.make(getTryoutExamIcons(row.examKey), row.setKey),
              ]),
              (look) => (
                <CatalogCardTile
                  key={look.seed}
                  seed={look.seed}
                  shift={look.shift}
                >
                  <TileIcon icon={look.icon} />
                </CatalogCardTile>
              )
            )}
          </div>
          {row.description === undefined ? null : (
            <p className="text-muted-foreground text-sm" dir="auto">
              {row.description}
            </p>
          )}
          <TryoutSetParts sections={row.sections} />
        </div>
      </PaneBody>
      <PaneFooter>
        <p className="text-muted-foreground me-auto text-sm">
          {t("set-pane-footer")}
        </p>
        <TryoutPressProvider>
          <TryoutStartProvider>
            <TryoutSetStart row={row} />
          </TryoutStartProvider>
        </TryoutPressProvider>
      </PaneFooter>
    </>
  );
}

/**
 * The parts of a set that has more than one, as the sketch draws them: a card each with its icon and name, three
 * across on a wide pane, each opening the part's own page. A set of one part shows none.
 */
function TryoutSetParts({ sections }: { sections: TryoutSetRow["sections"] }) {
  const t = useTranslations("Tryouts");
  if (sections.length < 2) {
    return null;
  }
  const looks = getTileLooks(
    Arr.map(sections, (section) =>
      Tuple.make(getTryoutSubjectIcons(section.sectionKey), section.sectionKey)
    )
  );

  return (
    <section className="@container flex flex-col gap-3">
      <h3 className="text-sm font-medium">{t("set-pane-parts")}</h3>
      <div className="grid grid-cols-2 gap-3 @md:grid-cols-3">
        {Arr.map(Arr.zip(sections, looks), ([section, look]) => (
          <TryoutSetPart
            key={section.sectionKey}
            look={look}
            section={section}
          />
        ))}
      </div>
    </section>
  );
}

/** One part of the open set: its tile and name, opening its page when it has one. */
function TryoutSetPart({
  look,
  section,
}: {
  look: TileLook;
  section: TryoutSetRow["sections"][number];
}) {
  if (section.publicPath === undefined) {
    return null;
  }

  return (
    <TryoutPageLink
      className="hover:bg-accent hover:text-accent-foreground flex flex-col overflow-hidden rounded-xl border transition-colors ease-out"
      publicPath={section.publicPath}
    >
      <CatalogCardTile seed={look.seed} shift={look.shift}>
        <TileIcon icon={look.icon} />
      </CatalogCardTile>
      <span className="truncate p-3 text-sm font-medium" title={section.title}>
        {section.title}
      </span>
    </TryoutPageLink>
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
