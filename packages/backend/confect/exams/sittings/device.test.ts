import { describe, expect, it } from "@effect/vitest";
import { deviceBinding } from "@repo/backend/confect/exams/sittings/device";

const DEVICE = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const RETIRED = "00000000-0000-4000-8000-000000000003";

describe("exams/sittings device binding", () => {
  it("reports the owning device as bound", () => {
    expect(
      deviceBinding({ deviceId: DEVICE, retiredDeviceIds: [] }, DEVICE)
    ).toBe("bound");
  });

  it("reports a device that a proctor retired as retired, even when no device is bound", () => {
    expect(
      deviceBinding({ deviceId: null, retiredDeviceIds: [RETIRED] }, RETIRED)
    ).toBe("retired");
  });

  it("reports any device as unbound when a proctor allowed another device", () => {
    expect(
      deviceBinding({ deviceId: null, retiredDeviceIds: [DEVICE] }, OTHER)
    ).toBe("unbound");
  });

  it("reports a device that is neither the owner nor retired as another device", () => {
    expect(
      deviceBinding({ deviceId: DEVICE, retiredDeviceIds: [RETIRED] }, OTHER)
    ).toBe("other");
  });
});
