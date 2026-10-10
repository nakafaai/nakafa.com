/**
 * What the editor's Tailwind language server reads as classes. It completes,
 * sorts, and checks a class string only inside these JSX attributes and calls,
 * so the class policy treats them as the class positions. `editor.test.ts`
 * keeps both lists equal to the `classAttributes` and `classFunctions` of the
 * editor settings in `.zed/settings.json` and `.vscode/settings.json`.
 */

/** The JSX attributes whose value the language server reads as classes. */
export const CLASS_ATTRIBUTES = [
  "class",
  "className",
  "classList",
  "containerClassName",
  "classNames",
];

/** The calls whose arguments the language server reads as classes. */
export const CLASS_FUNCTIONS = ["cn", "cva", "cx", "clsx", "twMerge"];
