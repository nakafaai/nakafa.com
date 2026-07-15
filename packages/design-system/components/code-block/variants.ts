import { cva } from "class-variance-authority";

/** Applies Shiki's paired dark-theme variables inside a code surface. */
export const codeBlockDarkModeVariants = cva(
  "dark:[&_.shiki]:font-(--shiki-dark-font-weight)! dark:[&_.shiki]:text-(--shiki-dark)! dark:[&_.shiki]:[font-style:var(--shiki-dark-font-style)]! dark:[&_.shiki]:[text-decoration:var(--shiki-dark-text-decoration)]! dark:[&_.shiki_span]:font-(--shiki-dark-font-weight)! dark:[&_.shiki_span]:text-(--shiki-dark)! dark:[&_.shiki_span]:[font-style:var(--shiki-dark-font-style)]! dark:[&_.shiki_span]:[text-decoration:var(--shiki-dark-text-decoration)]!"
);
