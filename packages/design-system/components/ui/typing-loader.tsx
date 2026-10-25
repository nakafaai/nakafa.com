import { useIntersection } from "@mantine/hooks";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";

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
  "rounded-full bg-primary motion-safe:animate-[typing_1s_infinite]",
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

/** The dots bounce only while the loader is on screen. They rest while it is out of view. */
export function TypingLoader({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const t = useTranslations("Common");
  const { entry, ref } = useIntersection({ threshold: 0 });
  const playing = entry?.isIntersecting ?? false;

  return (
    <div className={cn(containerVariants({ size }), className)} ref={ref}>
      {Arr.map(DOT_DELAYS, (delay) => (
        <div
          className={dotVariants({ size })}
          key={delay}
          style={{
            animationDelay: `${delay}ms`,
            animationPlayState: playing ? "running" : "paused",
          }}
        />
      ))}
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
