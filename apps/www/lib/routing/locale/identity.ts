import type { PublicRoute } from "@repo/contents/_types/route/schema";

/** Matches localized projected route rows by stable source identity, not public slug text. */
export function isSamePublicRouteIdentity(
  left: PublicRoute,
  right: PublicRoute
) {
  if (left.kind !== right.kind) {
    return false;
  }

  if (
    left.kind === "curriculum-context" &&
    right.kind === "curriculum-context"
  ) {
    return (
      left.programKey === right.programKey && left.nodeKey === right.nodeKey
    );
  }

  return (
    "sourcePath" in left &&
    "sourcePath" in right &&
    left.sourcePath === right.sourcePath
  );
}
