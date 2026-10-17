import { Array as Arr } from "effect";

/** Counts the queries one spied database ran against the three IRT tables. */
export function countIrtQueries(calls: readonly (readonly [string])[]) {
  const count = (tableName: string) =>
    Arr.filter(calls, ([name]) => name === tableName).length;
  return {
    calibrationRunQueryCount: count("irtCalibrationRuns"),
    placementQueryCount: count("tryoutAttemptPlacements"),
    scaleItemQueryCount: count("irtScaleItems"),
  };
}
