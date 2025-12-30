import { cn } from "@repo/design-system/lib/utils";

const DOT_DELAY = 250;

export function TypingLoader({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dotSizes = {
    sm: "h-1 w-1",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
  };

  const containerSizes = {
    sm: "h-4",
    md: "h-5",
    lg: "h-6",
  };

  return (
    <div
      className={cn(
        "flex items-center space-x-1",
        containerSizes[size],
        className
      )}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          className={cn(
            "animate-[typing_1s_infinite] rounded-full bg-primary",
            dotSizes[size]
          )}
          key={`dot-${i + 1}`}
          style={{
            animationDelay: `${i * DOT_DELAY}ms`,
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
