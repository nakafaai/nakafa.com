import type { Ref } from "@confect/core";
import type { InvokeReturn } from "@confect/react";
import type learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import { useRequired } from "@repo/design-system/hooks/required";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { createContext, type ReactNode } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ConvexIsland } from "@/components/providers/island";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import {
  type CrumbSiblings,
  crumbSiblings,
  siblingCrumb,
} from "@/components/shared/breadcrumb/pages";
import { CountryFlagIcon } from "@/components/shared/flag";
import { reportClientException } from "@/lib/analytics/client";
import type { readRuntimeCurriculumOptions } from "@/lib/curriculum/model";
import { useSetPreferredCurriculumMutation } from "@/lib/curriculum/mutation";
import type { CurriculumTrail } from "@/lib/curriculum/trail";
import { isActiveLocale } from "@/lib/i18n/active";
import {
  CURRICULA_TARGET,
  curriculumPublicPathTarget,
  HOME_TARGET,
} from "@/lib/routing/target";

type CurriculumOption = ReturnType<typeof readRuntimeCurriculumOptions>[number];
type SavePreferredCurriculum = (
  args: Ref.Args<typeof learningPreferences.mutations.setPreferredCurriculum>
) => InvokeReturn<typeof learningPreferences.mutations.setPreferredCurriculum>;

/** Expected failure when a background curriculum preference save fails. */
class CurriculumPreferenceSaveError extends Schema.TaggedError<
  CurriculumPreferenceSaveError,
  { readonly brand: unique symbol }
>()("CurriculumPreferenceSaveError", {
  cause: Schema.Unknown,
}) {}

/** The menu heading of each level of a curriculum path, a one-word `menu-` key. */
const LEVEL_MENUS = {
  class: "menu-class",
  course: "menu-subject",
  stage: "menu-level",
  subject: "menu-subject",
  track: "menu-curriculum",
} as const satisfies Record<CurriculumTrail[number]["level"], string>;

/** What the header reads: the page's path, the catalog's curricula a learner may save, and the labels. */
interface CurriculumHeaderValue {
  /** What the header holds at its end, such as the toggle of a page's outline. */
  action?: ReactNode;
  homeLabel: string;
  options: readonly CurriculumOption[];
  subjectLabel: string;
  title: string;
  trail: CurriculumTrail;
}

const CurriculumHeaderContext = createContext<CurriculumHeaderValue | null>(
  null
);

/** Reads the header's value around a variant of it. */
function useCurriculumHeader() {
  return useRequired(CurriculumHeaderContext, "useCurriculumHeader");
}

/**
 * The header of a curriculum page, whose breadcrumb is its navigation, as Google Drive's path is and as the try-out
 * catalog's is: Subjects, then the curriculum, and each page under it down to this one, each crumb a menu of its
 * siblings. A learner's choice of curriculum is saved through the page's live client, once the page holds one; a
 * visitor's crumbs link alone.
 */
export function CurriculumHeader(props: CurriculumHeaderValue) {
  return (
    <CurriculumHeaderContext value={props}>
      <ConvexIsland fallback={<CurriculumPath />} keepsPress>
        <LearnerCurriculumPath />
      </ConvexIsland>
    </CurriculumHeaderContext>
  );
}

/** A learner's path: choosing another curriculum saves it as the learner's curriculum. */
function LearnerCurriculumPath() {
  const { options, trail } = useCurriculumHeader();
  const locale = useLocale();
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const setPreferredCurriculum = useSetPreferredCurriculumMutation(
    Arr.flatMap(options, (option) =>
      option.publicSlug
        ? [
            {
              ...(option.countryCode === undefined
                ? {}
                : { countryCode: option.countryCode }),
              key: option.programKey,
              publicSlug: option.publicSlug,
              title: option.title,
            },
          ]
        : []
    )
  );
  const current = Option.flatMap(Arr.head(trail), (level) =>
    Arr.findFirst(level.options, (option) => option.current)
  );

  /** Saves the curriculum a learner chose, unless it is the page's own. */
  function chooseCurriculum(choice: { readonly label: string }) {
    const chosen = Arr.findFirst(
      options,
      (option) =>
        option.title === choice.label &&
        Option.match(current, {
          onNone: () => true,
          onSome: (own) => own.publicPath !== option.publicPath,
        })
    );
    if (Option.isNone(chosen) || !(isAuthenticated && isActiveLocale(locale))) {
      return;
    }
    Effect.runFork(
      saveCurriculumPreference({
        errorMessage: {
          description: "curriculum-preference-error.description",
          title: "curriculum-preference-error.title",
        },
        locale,
        programKey: chosen.value.programKey,
        setPreferredCurriculum,
      })
    );
  }

  return <CurriculumPath onChooseCurriculum={chooseCurriculum} />;
}

/** The header's path: Subjects, then a crumb for each level of the page's path. */
function CurriculumPath({
  onChooseCurriculum,
}: {
  onChooseCurriculum?: CrumbSiblings["onChoose"];
}) {
  const { action, homeLabel, subjectLabel, title, trail } =
    useCurriculumHeader();
  const common = useTranslations("Common");
  const crumbs = Arr.getSomes(
    Arr.map(trail, (level) =>
      siblingCrumb(
        crumbSiblings({
          label: common(LEVEL_MENUS[level.level]),
          onChoose: level.level === "track" ? onChooseCurriculum : undefined,
          options: Arr.getSomes(
            Arr.map(level.options, (option) =>
              Option.map(
                curriculumPublicPathTarget(option.publicPath),
                (target) => ({
                  current: option.current,
                  icon:
                    option.countryCode === undefined ? (
                      option.icon
                    ) : (
                      <CountryFlagIcon countryCode={option.countryCode} />
                    ),
                  label: option.title,
                  target,
                })
              )
            )
          ),
        })
      )
    )
  );

  return (
    <BreadcrumbHeader
      value={{
        action,
        home: HOME_TARGET,
        homeLabel,
        items: [{ label: subjectLabel, target: CURRICULA_TARGET }, ...crumbs],
        title,
      }}
    />
  );
}

/** Persists curriculum selection without blocking route navigation. */
function saveCurriculumPreference({
  errorMessage,
  locale,
  programKey,
  setPreferredCurriculum,
}: {
  errorMessage: ToastCopy;
  locale: Locale;
  programKey: string;
  setPreferredCurriculum: SavePreferredCurriculum;
}) {
  return Effect.tryPromise({
    try: () =>
      setPreferredCurriculum({
        locale,
        preferredCurriculumProgramKey: programKey,
      }),
    catch: (cause) => new CurriculumPreferenceSaveError({ cause }),
  }).pipe(
    Effect.flatMap((result) =>
      Effect.fromResult(result).pipe(
        Effect.mapError((cause) => new CurriculumPreferenceSaveError({ cause }))
      )
    ),
    Effect.catchTag("CurriculumPreferenceSaveError", (error) =>
      reportClientException(error, {
        programKey,
        source: "curriculum-crumb",
      }).pipe(
        Effect.andThen(
          Effect.sync(() => {
            toast.error(errorMessage, { position: "bottom-center" });
          })
        )
      )
    )
  );
}
