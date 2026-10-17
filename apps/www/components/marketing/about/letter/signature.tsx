import { cn } from "cn";

/**
 * The founder's signature, drawn in code from the six strokes of the approved
 * asset. Its ink is the text colour around it, so it reads in both themes.
 */
export function Signature({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <svg
      aria-label={label}
      className={cn(
        "h-auto w-50 fill-none stroke-3 stroke-foreground",
        className
      )}
      role="img"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 200 84"
    >
      <path d="M10,62 C12,44 15,28 20,14 C25,30 33,50 42,62 C44,44 48,26 55,10" />
      <path d="M82,40 C74,31 61,37 61,50 C61,62 75,62 82,46 C81,54 81,62 88,61" />
      <path d="M102,10 C98,28 95,46 95,60 C99,48 109,42 114,50 C118,58 108,66 97,58" />
      <path d="M127,40 C125,48 124,56 128,61 M130,27 L130.4,28" />
      <path d="M146,8 C141,26 138,46 140,58 C141,63 147,61 152,56" />
      <path d="M22,76 C72,68 132,68 190,74" />
    </svg>
  );
}
