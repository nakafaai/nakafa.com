import {
  COHORT_GRADE_MAX,
  COHORT_GRADE_MIN,
} from "@repo/backend/confect/tenancy/cohort";
import { languages } from "@repo/internationalization/data/lang";
import { Array as Arr } from "effect";

/** Every IANA time zone that the platform knows, as the time zone choices of a unit. */
export const timeZoneItems = Arr.map(
  Intl.supportedValuesOf("timeZone"),
  (zone) => ({ label: zone, value: zone })
);

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
