import type {
  Binding,
  DeviceId,
} from "@repo/backend/confect/assessment/gate/store";
import { Array as Arr } from "effect";

/**
 * How one device session stands with an attempt. `free`: the attempt binds no device.
 * `bound`: the device owns it. `retired`: a proctor retired the device, which may never
 * write again. `unbound`: a proctor allowed a new device, and none has entered yet.
 * `other`: any other device. A retired device is checked before anything else.
 */
type Standing = "free" | "bound" | "retired" | "unbound" | "other";

/** Where one device stands with the binding of an attempt. */
export function standingOf(binding: Binding, device: DeviceId): Standing {
  if (binding.kind === "free") {
    return "free";
  }
  if (Arr.contains(binding.retired, device)) {
    return "retired";
  }
  if (binding.kind === "unbound") {
    return "unbound";
  }
  return binding.device === device ? "bound" : "other";
}
