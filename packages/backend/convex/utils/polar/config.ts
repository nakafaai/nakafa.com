/** Whether Polar should target production or sandbox resources. */
export const isPolarProduction =
  process.env.NEXT_PUBLIC_POLAR_SERVER === "production";

/** Polar API environment selected from the public deployment mode. */
export const polarServer = isPolarProduction ? "production" : "sandbox";
