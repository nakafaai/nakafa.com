import { cn } from "cn";

const DOT_DELAYS = [0, 250, 500];
const DOT_SIZES = {
  sm: "h-1 w-1",
  md: "h-1.5 w-1.5",
  lg: "h-2 w-2",
};
const CONTAINER_SIZES = {
  sm: "h-4",
  md: "h-5",
  lg: "h-6",
};

export function TypingLoader({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "flex items-center space-x-1",
        CONTAINER_SIZES[size],
        className
      )}
    >
      {DOT_DELAYS.map((delay) => (
        <div
          className={cn(
            "animate-[typing_1s_infinite] rounded-full bg-primary",
            DOT_SIZES[size]
          )}
          key={delay}
          style={{
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}
