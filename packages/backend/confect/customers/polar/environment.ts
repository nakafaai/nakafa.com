import { polarKeys } from "@repo/backend/public";

/** Whether Polar should target production or sandbox resources. */
export const isPolarProduction =
  polarKeys().NEXT_PUBLIC_POLAR_SERVER === "production";
