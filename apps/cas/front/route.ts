import { Schema } from "effect";

export const CAS_HEALTH_PATH = "/health";
export const CAS_MATH_PATH = "/api/math";

/** What a request asks the front to do, decided from its method and path alone. */
export const CasRoute = Schema.Literals([
  "health",
  "math",
  "methodNotAllowed",
  "notFound",
]);
export type CasRoute = typeof CasRoute.Type;

export function routeOf(method: string, pathname: string): CasRoute {
  if (pathname === CAS_HEALTH_PATH) {
    return method === "GET" ? "health" : "methodNotAllowed";
  }
  if (pathname === CAS_MATH_PATH) {
    return method === "POST" ? "math" : "methodNotAllowed";
  }
  return "notFound";
}
