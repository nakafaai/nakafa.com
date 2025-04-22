import { Skeleton } from "../ui/skeleton";

type Props = {
  lines?: number;
};

export function SkeletonText({ lines = 5 }: Props) {
  return (
    <div className="my-10 flex flex-col gap-6">
      {/* heading */}
      <Skeleton className="h-6 w-1/2" />

      {/* content */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, index) => {
          const widthPercentage = Math.max(10, 100 - index * 20);
          const width = index === 0 ? "100%" : `${widthPercentage}%`;
          return (
            <Skeleton key={index} style={{ width: width }} className="h-4" />
          );
        })}
      </div>
    </div>
  );
}
