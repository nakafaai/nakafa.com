import {
  COHORT_GRADE_MAX,
  COHORT_GRADE_MIN,
} from "@repo/backend/confect/tenancy/cohort";
import type { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option } from "effect";

/**
 * The national grade range of each unit level, its first and its last grade: SD and MI teach 1 to 6, SMP and MTs 7
 * to 9, and SMA, MA, and SMK 10 to 12. A Malaysian SK teaches Tahun 1 to 6, an SMK and an SMKA Tingkatan 1 to 5 (SPM),
 * and a Form 6 college Tingkatan 6 (STPM). The last grade is the one whose students graduate. PAUD, SLB, and other
 * follow no national range.
 */
const LEVEL_GRADES: Record<
  typeof UnitLevel.Type,
  readonly [first: number, last: number] | undefined
> = {
  ma: [10, 12],
  mi: [1, 6],
  mts: [7, 9],
  "my-form6": [6, 6],
  "my-sk": [1, 6],
  "my-smk": [1, 5],
  "my-smka": [1, 5],
  other: undefined,
  paud: undefined,
  sd: [1, 6],
  sma: [10, 12],
  smk: [10, 12],
  smp: [7, 9],
  slb: undefined,
};

/** The national grade range of a unit level, if it has one. */
const rangeOf = (level: typeof UnitLevel.Type) =>
  Option.fromUndefinedOr(LEVEL_GRADES[level]);

/**
 * The grades a cohort of a unit of this level may hold, lowest first: the level's national range, or every grade a
 * cohort may hold for a level without one.
 */
export const gradesOf = (level: typeof UnitLevel.Type) =>
  Option.match(rangeOf(level), {
    onNone: () => Arr.range(COHORT_GRADE_MIN, COHORT_GRADE_MAX),
    onSome: ([first, last]) => Arr.range(first, last),
  });

/** The last grade of a unit level, whose students graduate, if the level has a national range. */
export const lastGradeOf = (level: typeof UnitLevel.Type) =>
  Option.map(rangeOf(level), ([, last]) => last);
