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

  if (left.kind === "tryout-country" && right.kind === "tryout-country") {
    return left.countryKey === right.countryKey;
  }

  if (left.kind === "tryout-exam" && right.kind === "tryout-exam") {
    return (
      left.countryKey === right.countryKey && left.examKey === right.examKey
    );
  }

  if (left.kind === "tryout-track" && right.kind === "tryout-track") {
    return (
      left.countryKey === right.countryKey &&
      left.examKey === right.examKey &&
      left.trackKey === right.trackKey
    );
  }

  if (left.kind === "tryout-set" && right.kind === "tryout-set") {
    return (
      left.countryKey === right.countryKey &&
      left.examKey === right.examKey &&
      left.trackKey === right.trackKey &&
      left.setKey === right.setKey
    );
  }

  if (left.kind === "tryout-section" && right.kind === "tryout-section") {
    return (
      left.countryKey === right.countryKey &&
      left.examKey === right.examKey &&
      left.trackKey === right.trackKey &&
      left.setKey === right.setKey &&
      left.sectionKey === right.sectionKey
    );
  }

  return (
    "sourcePath" in left &&
    "sourcePath" in right &&
    left.sourcePath === right.sourcePath
  );
}
