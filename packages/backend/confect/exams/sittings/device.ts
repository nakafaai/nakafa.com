import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import { Array as Arr } from "effect";

/** The two fields of an attempt that decide where a device stands with it. */
type DeviceFields = Pick<ExamAttemptsDoc, "deviceId" | "retiredDeviceIds">;

/**
 * How one device stands with an attempt. `bound`: the device owns it. `retired`: a
 * proctor retired the device, which may never write to the attempt again. `unbound`: a
 * proctor allowed another device, and none has entered yet. `other`: any other device.
 * A retired device is checked before an unbound attempt, so it never binds again.
 */
export const deviceBinding = (
  attempt: DeviceFields,
  deviceId: string
): "bound" | "retired" | "unbound" | "other" => {
  if (attempt.deviceId === deviceId) {
    return "bound";
  }
  if (Arr.contains(attempt.retiredDeviceIds, deviceId)) {
    return "retired";
  }
  if (attempt.deviceId === null) {
    return "unbound";
  }
  return "other";
};
