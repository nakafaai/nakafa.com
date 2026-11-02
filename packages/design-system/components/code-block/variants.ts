import { cva } from "class-variance-authority";

/*
 * The anatomy of a code block. A lesson's block (`CodeBlock`) and a response's (`CodeFence`), which a
 * try-out question and a reply draw, share it, so code reads alike everywhere: one frame, one bar over
 * the code, one name in that bar, and one body of numbered lines.
 */

/** A code block's frame: rounded and bordered, with the code as wide as the frame. */
export const codeFrameVariants = cva(
  "grid w-full grid-cols-1 overflow-hidden rounded-xl border"
);

/** The bar over the code, on the stronger muted surface with a rule under it: the name first, the actions last. */
export const codeHeaderVariants = cva(
  "bg-muted/80 text-muted-foreground flex items-center justify-between gap-2 border-b p-1 text-sm"
);

/** The name in that bar with its icon: a lesson's file name or a response's language. */
export const codeLabelVariants = cva(
  "flex min-w-0 items-center gap-2 px-4 py-1.5"
);

/**
 * The code: Shiki's lines, or the plain lines that hold their place, on the muted surface, each line
 * numbered, with Shiki's notation for highlighted, changed, focused and marked words, and the colours
 * of its dark theme.
 */
export const codeBodyVariants = cva(
  "bg-muted/40 [&_.line.diff.add]:after:bg-primary [&_.line.diff.remove]:after:bg-destructive [&_.line.highlighted]:after:bg-primary [&_.line]:before:text-muted-foreground [&_.line.focused]:filter-none mt-0 text-sm [&_.highlighted-word]:underline [&_.highlighted-word]:decoration-current [&_.highlighted-word]:underline-offset-2 [&_.line]:relative [&_.line]:w-full [&_.line]:px-4 [&_.line]:[filter:var(--code-line-filter)] [&_.line]:before:mr-4 [&_.line]:before:inline-block [&_.line]:before:w-4 [&_.line]:before:text-right [&_.line]:before:font-mono [&_.line]:before:text-xs [&_.line]:before:content-[counter(line)] [&_.line]:before:select-none [&_.line]:before:[counter-increment:line] [&_.line.diff]:after:absolute [&_.line.diff]:after:top-0 [&_.line.diff]:after:bottom-0 [&_.line.diff]:after:left-0 [&_.line.diff]:after:w-0.5 [&_.line.highlighted]:after:absolute [&_.line.highlighted]:after:top-0 [&_.line.highlighted]:after:bottom-0 [&_.line.highlighted]:after:left-0 [&_.line.highlighted]:after:w-0.5 [&_.shiki]:bg-transparent! dark:[&_.shiki]:font-(--shiki-dark-font-weight)! dark:[&_.shiki]:text-(--shiki-dark)! dark:[&_.shiki]:[font-style:var(--shiki-dark-font-style)]! dark:[&_.shiki]:[text-decoration:var(--shiki-dark-text-decoration)]! dark:[&_.shiki_span]:font-(--shiki-dark-font-weight)! dark:[&_.shiki_span]:text-(--shiki-dark)! dark:[&_.shiki_span]:[font-style:var(--shiki-dark-font-style)]! dark:[&_.shiki_span]:[text-decoration:var(--shiki-dark-text-decoration)]! [&_code]:grid [&_code]:w-full [&_code]:bg-transparent [&_code]:[counter-increment:line_0] [&_code]:[counter-reset:line] [&_code:has(.focused)]:[--code-line-filter:blur(2px)] [&_pre]:overflow-x-auto [&_pre]:py-4"
);
