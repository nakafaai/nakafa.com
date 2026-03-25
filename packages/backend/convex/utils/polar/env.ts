import { ConvexError } from "convex/values";

/** Read one required Polar environment variable and fail closed when missing. */
export function requirePolarEnv(
  name: "POLAR_ACCESS_TOKEN" | "POLAR_WEBHOOK_SECRET"
) {
  const value = process.env[name];

  if (value) {
    return value;
  }

  throw new ConvexError({
    code: "POLAR_ENV_MISSING",
    message: `Missing required Polar environment variable: ${name}`,
  });
}
