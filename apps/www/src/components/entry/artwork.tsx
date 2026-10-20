import { useMediaQuery } from "@mantine/hooks";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { lazyComponent } from "@repo/design-system/lib/lazy";

/**
 * Loads the animal pool only when the entry page shows it. Its code stays out of
 * the entry routes' first JavaScript, and nothing stands in while it loads.
 */
const DeferredPool = lazyComponent(
  () =>
    import("@repo/design-system/components/pool/pool").then(
      (module) => module.Pool
    ),
  {
    loading: () => null,
    ssr: false,
  }
);

/**
 * Shows the animal pool beside the sign-in form on wide screens, where the layout
 * shows the column, and only once the client has measured the screen. Until then
 * the column stays empty, so the page neither waits for nor shows a placeholder.
 * A failed load leaves the column plain instead of replacing the sign-in page.
 */
export function EntryShellArtwork() {
  const isLargeScreen = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);

  return (
    <div
      className="relative col-span-4 hidden bg-muted lg:block"
      data-slot="entry-artwork"
    >
      {isLargeScreen ? (
        <ErrorBoundary fallback={null}>
          <DeferredPool />
        </ErrorBoundary>
      ) : null}
    </div>
  );
}
