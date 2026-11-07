import {
  Atom01Icon,
  Backpack01Icon,
  Book01Icon,
  Book02Icon,
  Book03Icon,
  BookOpen01Icon,
  Building03Icon,
  CalculatorIcon,
  CompassIcon,
  Globe02Icon,
  MicroscopeIcon,
  Mortarboard01Icon,
  NotebookIcon,
  PencilIcon,
  RulerIcon,
  School01Icon,
  SchoolIcon,
  User02Icon,
  UserAccountIcon,
  UserCheck01Icon,
  UserCircleIcon,
  UserEdit01Icon,
  UserIcon,
  UserLove01Icon,
  UserSettings01Icon,
  UserShield01Icon,
  UserSquareIcon,
  UserStar01Icon,
} from "@hugeicons/core-free-icons";
import { CountryCodeSchema } from "@nakafa/aksara-contracts/country";
import {
  COHORT_GRADE_MAX,
  COHORT_GRADE_MIN,
  CohortGrade,
} from "@repo/backend/confect/tenancy/cohort";
import { languages } from "@repo/internationalization/data/lang";
import { countries } from "country-flag-icons";
import {
  Array as Arr,
  Option,
  Number as Ord,
  Order,
  Result,
  Schema,
} from "effect";

/** Every IANA time zone that the platform knows, as the time zone choices of a unit. */
export const timeZoneItems = Arr.map(
  Intl.supportedValuesOf("timeZone"),
  (zone) => ({ label: zone, value: zone })
);

/**
 * Every country a school may name: each ISO 3166-1 code the flag package draws that
 * the platform names, so every country in the world shows with its flag, sorted by
 * its name in the viewer's language. The package also draws subdivisions such as
 * GB-ENG and ES-CT, which no school can save and which `Intl.DisplayNames` refuses
 * with a RangeError, so only country codes are named.
 */
export function countryChoices(locale: string) {
  const names = new Intl.DisplayNames([locale], {
    fallback: "none",
    type: "region",
  });
  const collator = new Intl.Collator(locale);
  return Arr.sort(
    Arr.filterMap(Arr.filter(countries, Schema.is(CountryCodeSchema)), (code) =>
      Option.match(Option.fromNullishOr(names.of(code)), {
        onNone: () => Result.failVoid,
        onSome: (label) => Result.succeed({ label, value: code }),
      })
    ),
    Order.make((a: { readonly label: string }, b) =>
      Ord.sign(collator.compare(a.label, b.label))
    )
  );
}

/** The page languages a unit may choose, from the platform's list of languages, each with its flag. */
export const languageItems = Arr.map(languages, (language) => ({
  countryCode: language.countryCode,
  label: language.label,
  value: language.value,
}));

/** The school years a cohort may hold, as the grade choices of its dialog and of its filter. */
export const gradeItems = Arr.makeBy(
  COHORT_GRADE_MAX - COHORT_GRADE_MIN + 1,
  (index) => {
    const grade = String(COHORT_GRADE_MIN + index);
    return { label: grade, value: grade };
  }
);

/**
 * The icons of study, one for each school year, which the filters of the cohorts' grades and of a list's class groups
 * draw.
 */
export const GRADE_ICONS = [
  Backpack01Icon,
  PencilIcon,
  Book01Icon,
  RulerIcon,
  NotebookIcon,
  CalculatorIcon,
  Book02Icon,
  CompassIcon,
  Globe02Icon,
  Book03Icon,
  Atom01Icon,
  MicroscopeIcon,
  BookOpen01Icon,
  Mortarboard01Icon,
] as const;

/** The icons of the people in a filter of names, such as the audit's Who or the library's Added by: one of a person for each. */
export const PERSON_ICONS = [
  UserIcon,
  UserCircleIcon,
  UserSquareIcon,
  UserStar01Icon,
  UserAccountIcon,
  UserCheck01Icon,
  UserEdit01Icon,
  UserLove01Icon,
  UserSettings01Icon,
  UserShield01Icon,
] as const;

/** The school year that a grade choice holds, if the choice holds one the schema accepts. */
export function chosenGrade(value: string | null) {
  return value === null
    ? Option.none()
    : Schema.decodeOption(CohortGrade)(Number(value));
}

/** The icons a filter of a school's units draws from. */
export const UNIT_ICONS = [School01Icon, SchoolIcon, Building03Icon] as const;

/** The icons a filter of teachers draws from. */
export const TEACHER_ICONS = [UserIcon, User02Icon, UserCircleIcon] as const;
