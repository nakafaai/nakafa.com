import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";

const DOT_DELAYS = [0, 250, 500];

/** The row that holds the dots, as tall as the dots are large. */
const containerVariants = cva("flex items-center space-x-1", {
  variants: {
    size: {
      sm: "h-4",
      md: "h-5",
      lg: "h-6",
    },
  },
});

/** One animated dot of the loader. */
const dotVariants = cva(
  "animate-[typing_1s_infinite] rounded-full bg-primary",
  {
    variants: {
      size: {
        sm: "h-1 w-1",
        md: "h-1.5 w-1.5",
        lg: "h-2 w-2",
      },
    },
  }
);

export function TypingLoader({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className={cn(containerVariants({ size }), className)}>
      {Arr.map(DOT_DELAYS, (delay) => (
        <div
          className={dotVariants({ size })}
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
