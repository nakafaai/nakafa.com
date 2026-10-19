"use client";

import {
  isToastRequested,
  subscribeToastRequests,
} from "@repo/design-system/lib/toast/notify";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { useSyncExternalStore } from "react";

/** The Toaster and Sonner's view load with the first toast, so a page without one never loads them. */
const Toaster = dynamic(
  () =>
    import("@repo/design-system/components/ui/sonner").then(
      (module) => module.Toaster
    ),
  { ssr: false }
);

/** Mounts the app's Toaster when the first toast asks for it, and renders nothing before that. */
export function ToasterHost(props: ComponentProps<typeof Toaster>) {
  const requested = useSyncExternalStore(
    subscribeToastRequests,
    isToastRequested,
    () => false
  );

  return requested ? <Toaster {...props} /> : null;
}
