"use client";

import dynamic from "next/dynamic";

/**
 * The failure screen, loaded only when a failure reaches it, so each error root
 * keeps its own code small. The roots of every route belong to the first
 * JavaScript, so they carry only this reference. `ssr` keeps the screen in the
 * server HTML of a failure.
 */
export const DeferredFailure = dynamic(
  () => import("@/components/state/failure").then((module) => module.Failure),
  { ssr: true }
);
