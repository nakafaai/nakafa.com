const LOCAL_SITE_URL = "http://localhost:3000";

/** Environment values used by the Better Auth Convex boundary. */
export const authEnvironment = {
  googleClientId: process.env.AUTH_GOOGLE_ID ?? "",
  googleClientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
  jwks: process.env.JWKS,
  siteUrl: process.env.SITE_URL ?? LOCAL_SITE_URL,
};
