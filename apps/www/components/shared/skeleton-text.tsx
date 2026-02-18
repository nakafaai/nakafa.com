import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { cn } from "@repo/design-system/lib/utils";

const DEFAULT_LINES_COUNT = 5;
const WIDTH_PERCENTAGE_MIN = 10;
const WIDTH_PERCENTAGE_MAX = 100;
const WIDTH_PERCENTAGE_DIFFERENCE = 20;

interface Props {
  className?: string;
  lines?: number;
}

export function SkeletonText({
  lines = DEFAULT_LINES_COUNT,
  className,
}: Props) {
  return (
    <div className={cn("mx-auto max-w-3xl px-6", className)}>
      <div className="my-10 flex flex-col gap-6">
        {/* heading */}
        <Skeleton className="h-6 w-1/2" />

        {/* content */}
        <div className="flex flex-col gap-3">
          {Array.from({ length: lines }).map((_, index) => {
            const widthPercentage = Math.max(
              WIDTH_PERCENTAGE_MIN,
              WIDTH_PERCENTAGE_MAX - index * WIDTH_PERCENTAGE_DIFFERENCE
            );
            const width = index === 0 ? "100%" : `${widthPercentage}%`;
            return <Skeleton className="h-4" key={width} style={{ width }} />;
          })}
        </div>
      </div>
    </div>
  );
}
