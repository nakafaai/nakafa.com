import { Schema } from "effect";
export const irtCalibrationStatusValidator = Schema.Literals([
  "provisional",
  "emerging",
  "calibrated",
]);
export const irtCalibrationRunStatusValidator = Schema.Literals([
  "running",
  "completed",
  "failed",
]);
export const irtScaleVersionStatusValidator = Schema.Literals([
  "provisional",
  "official",
]);
export const irtOperationalModelValidator = Schema.Literals(["2pl"]);
