import { Skeleton } from "@repo/design-system/components/ui/skeleton";

export const card = {
  name: "Skeleton",
  group: "Feedback",
  height: 140,
  source: "components/ui/skeleton",
};

/** The card's live example. */
export function Preview() {
  return (
    <div className="flex items-center gap-4 p-6">
      <Skeleton className="size-10 rounded-full" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}
