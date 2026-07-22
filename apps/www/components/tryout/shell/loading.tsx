import { Skeleton } from "@repo/design-system/components/ui/skeleton";

/** Renders a stable try-out page shape for the current route depth. */
export function TryoutPageLoading({ kind }: { kind: "route" | "section" }) {
  if (kind === "route") {
    return <TryoutRouteLoading />;
  }

  return <TryoutSectionLoading />;
}

/** Mirrors shared route chrome without assuming the content surface below it. */
function TryoutRouteLoading() {
  return (
    <div data-slot="tryout-page-loading">
      <div aria-hidden="true">
        <header className="sticky top-16 z-10 flex min-h-16 w-full shrink-0 border-b bg-background lg:top-0">
          <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center px-6 py-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </header>
      </div>

      <TryoutRouteContentLoading />
    </div>
  );
}

/** Renders neutral route content without duplicating chooser chrome. */
export function TryoutRouteContentLoading() {
  return (
    <div aria-busy="true" data-slot="tryout-route-content-loading">
      <div
        aria-hidden="true"
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6"
      >
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Mirrors the section header, controls, question, and answer choices. */
function TryoutSectionLoading() {
  return (
    <div
      aria-busy="true"
      className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24"
      data-slot="tryout-page-loading"
    >
      <div aria-hidden="true" className="flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-56 max-w-full" />
          <Skeleton className="h-9 w-80 max-w-full" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </header>

        <div className="flex flex-col gap-12">
          <Skeleton className="h-24 w-full rounded-xl" />

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-3/4" />
            </div>

            <div className="flex flex-col gap-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
