import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

type Props = {
  lines?: number;
  className?: string;
};

export function SkeletonText({ lines = 5, className }: Props) {
  return (
    <div className="my-10 flex flex-col gap-3">
      {Array.from({ length: lines }).map((_, index) => {
        const widthPercentage = Math.max(10, 100 - index * 20);
        const width = index === 0 ? "100%" : `${widthPercentage}%`;
        return (
          <Skeleton
            key={index}
            style={{ width: width }}
            className={cn("h-4", className)}
          />
        );
      })}
    </div>
  );
}
