import { getTileLooks } from "@repo/design-system/lib/look";
import { Array as Arr, Effect, Option, Tuple } from "effect";
import { createContext, use } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import {
  BreadcrumbHeader,
  type BreadcrumbHeaderItem,
} from "@/components/shared/breadcrumb/header";
import {
  type CrumbSiblings,
  crumbSiblings,
} from "@/components/shared/breadcrumb/pages";
import { CountryFlagIcon } from "@/components/shared/flag";
import {
  getTryoutExamIcons,
  getTryoutGroupIcons,
  getTryoutSubjectIcons,
} from "@/components/tryout/catalog/icons";
import { saveTryoutPreference } from "@/components/tryout/catalog/preference";
import { getTryoutPublicPathTarget } from "@/components/tryout/route/path";
import type { TryoutTrail } from "@/components/tryout/route/trail";
import { HOME_TARGET, TRYOUT_TARGET } from "@/lib/routing/target";
import { useSetPreferredTryoutMutation } from "@/lib/tryout/mutation";

/** The page's trail, its labels and its title, which both variants of the header read. */
const TryoutTrailContext = createContext<{
  labels: { home: string; tryOut: string; tryOutShort: string };
  title: string;
  trail: TryoutTrail;
} | null>(null);

/** Reads the trail around a variant of the header. */
function useTryoutTrail() {
  const value = use(TryoutTrailContext);
  if (value === null) {
    throw new Error("useTryoutTrail must be used within TryoutTrailHeader");
  }
  return value;
}

/** The menu heading of each group axis: a year, a grade, or an institution. */
const GROUP_MENU_LABELS = {
  grade: "menu-grade",
  institution: "menu-institution",
  year: "menu-year",
} as const;

/**
 * One page a crumb offers, linked to its public path, or none when the path
 * names no try-out page.
 */
function sibling(
  path: string,
  option: Omit<CrumbSiblings["options"][number], "target">
) {
  return Option.map(getTryoutPublicPathTarget(path), (target) => ({
    ...option,
    target,
  }));
}

/**
 * One crumb of the trail, named after its own page: with two or more siblings
 * it opens them, else it links to its own page. A crumb whose own page is not
 * among its options names nothing, so it is left out.
 */
function trailCrumb(input: {
  readonly menu: string;
  readonly onChoose?: CrumbSiblings["onChoose"];
  readonly options: CrumbSiblings["options"];
}): Option.Option<BreadcrumbHeaderItem> {
  const { options } = input;
  return Option.map(
    Arr.findFirst(options, (option) => option.current),
    (own) =>
      options.length > 1
        ? {
            label: own.label,
            siblings: crumbSiblings({
              label: input.menu,
              onChoose: input.onChoose,
              options,
            }),
          }
        : { label: own.label, target: own.target }
  );
}

/**
 * The header of a try-out catalog page, whose breadcrumb is its navigation, as
 * Google Drive's path is: Try out, then the country, the exam, the group when
 * the exam offers that choice, and the track, each crumb a menu of its
 * siblings. A learner's choice of country is saved through the page's live
 * client, once the page holds one; a visitor's crumbs link alone.
 */
export function TryoutTrailHeader({
  labels,
  title,
  trail,
}: {
  labels: { home: string; tryOut: string; tryOutShort: string };
  title: string;
  trail: TryoutTrail;
}) {
  return (
    <TryoutTrailContext value={{ labels, title, trail }}>
      <ConvexIsland fallback={<TrailHeader />} keepsPress>
        <LearnerTrailHeader />
      </ConvexIsland>
    </TryoutTrailContext>
  );
}

/** A learner's header: choosing another country saves it as the learner's try-out country. */
function LearnerTrailHeader() {
  const { trail } = useTryoutTrail();
  const locale = useLocale();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const setPreferredTryout = useSetPreferredTryoutMutation(
    trail.country.options
  );

  /** Saves the country a learner chose, unless it is the page's own. */
  function chooseCountry(option: { readonly label: string }) {
    const country = Arr.findFirst(
      trail.country.options,
      (candidate) =>
        candidate.title === option.label &&
        candidate.value !== trail.country.current
    );
    if (Option.isNone(country) || !isAuthenticated) {
      return;
    }
    Effect.runFork(
      saveTryoutPreference({
        countryKey: country.value.countryKey,
        errorMessage: { title: "tryout-preference-error.title" },
        locale,
        setPreferredTryout,
        source: "tryout-country-crumb",
      })
    );
  }

  return <TrailHeader onChooseCountry={chooseCountry} />;
}

/** The crumb of the exam: a single year joins its name, as in SNBT 2027. */
function examCrumb(exam: NonNullable<TryoutTrail["exam"]>, menu: string) {
  const looks = getTileLooks(
    Arr.map(exam.options, (option) =>
      Tuple.make(getTryoutExamIcons(option.examKey), option.examKey)
    )
  );
  return Option.map(
    trailCrumb({
      menu,
      options: Arr.getSomes(
        Arr.zipWith(exam.options, looks, (option, look) =>
          sibling(option.entryPath, {
            current: option.value === exam.current,
            icon: look.icon,
            label: option.title,
          })
        )
      ),
    }),
    (crumb) => ({ ...crumb, label: exam.label })
  );
}

/** The crumb of the group: a grade, a Studienkolleg, or a year once SNBT has two. */
function groupCrumb(group: NonNullable<TryoutTrail["group"]>, menu: string) {
  const looks = getTileLooks(
    Arr.map(group.options, (option) =>
      Tuple.make(getTryoutGroupIcons(group.axis), option.groupKey)
    )
  );
  return trailCrumb({
    menu,
    options: Arr.getSomes(
      Arr.zipWith(group.options, looks, (option, look) =>
        sibling(option.entryPath, {
          current: option.value === group.current,
          icon: look.icon,
          label: option.title,
        })
      )
    ),
  });
}

/** The crumb of the track: a subject or a test of its group. */
function trackCrumb(track: NonNullable<TryoutTrail["track"]>, menu: string) {
  const looks = getTileLooks(
    Arr.map(track.options, (option) =>
      Tuple.make(getTryoutSubjectIcons(option.trackKey), option.trackKey)
    )
  );
  return trailCrumb({
    menu,
    options: Arr.getSomes(
      Arr.zipWith(track.options, looks, (option, look) =>
        sibling(option.value, {
          current: option.value === track.current,
          icon: look.icon,
          label: option.title,
        })
      )
    ),
  });
}

/** The header's path: Try out, then a crumb for each level of the trail. */
function TrailHeader({
  onChooseCountry,
}: {
  onChooseCountry?: CrumbSiblings["onChoose"];
}) {
  const { labels, title, trail } = useTryoutTrail();
  const common = useTranslations("Common");
  const crumbs = Arr.getSomes([
    trailCrumb({
      menu: common("menu-country"),
      onChoose: onChooseCountry,
      options: Arr.getSomes(
        Arr.map(trail.country.options, (option) =>
          sibling(option.value, {
            current: option.value === trail.country.current,
            icon: <CountryFlagIcon countryCode={option.countryCode} />,
            label: option.title,
          })
        )
      ),
    }),
    Option.flatMap(Option.fromNullishOr(trail.exam), (exam) =>
      examCrumb(exam, common("menu-exam"))
    ),
    Option.flatMap(Option.fromNullishOr(trail.group), (group) =>
      groupCrumb(group, common(GROUP_MENU_LABELS[group.axis]))
    ),
    Option.flatMap(Option.fromNullishOr(trail.track), (track) =>
      trackCrumb(track, common("menu-test"))
    ),
  ]);

  return (
    <BreadcrumbHeader
      value={{
        home: HOME_TARGET,
        homeLabel: labels.home,
        items: [
          {
            label: labels.tryOut,
            menuLabel: labels.tryOutShort,
            target: TRYOUT_TARGET,
          },
          ...crumbs,
        ],
        title,
      }}
    />
  );
}
