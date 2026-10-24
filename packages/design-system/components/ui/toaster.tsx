import {
  isToastRequested,
  subscribeToastRequests,
} from "@repo/design-system/lib/toast/notify";
import {
  type ComponentProps,
  lazy,
  Suspense,
  useSyncExternalStore,
} from "react";

/**
 * The Toaster and Sonner's view load with the first toast, so a page without one
 * never loads them. The host renders nothing on the server, where no toast exists.
 */
const Toaster = lazy(() =>
  import("@repo/design-system/components/ui/sonner").then((module) => ({
    default: module.Toaster,
  }))
);

/** Mounts the app's Toaster when the first toast asks for it, and renders nothing before that. */
export function ToasterHost(props: ComponentProps<typeof Toaster>) {
  const requested = useSyncExternalStore(
    subscribeToastRequests,
    isToastRequested,
    () => false
  );

  if (!requested) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <Toaster {...props} />
    </Suspense>
  );
}
