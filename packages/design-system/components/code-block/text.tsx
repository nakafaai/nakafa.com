import { cn } from "cn";
import { Fragment, type HTMLAttributes } from "react";

type CodeBlockTextProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
  preClassName?: string | undefined;
};

/** Gives repeated code lines stable keys based on their source offsets. */
function getCodeLines(code: string) {
  let offset = 0;

  return code.split("\n").map((line) => {
    const key = `${offset}:${line}`;
    offset += line.length + 1;
    return { key, line };
  });
}

/**
 * Draws code as plain text in the lines the highlighter produces, so the text
 * shown before or instead of highlighting has the highlighted code's size.
 */
export function CodeBlockText({
  children,
  preClassName,
  ...props
}: CodeBlockTextProps) {
  const lines = getCodeLines(children);

  return (
    <div {...props}>
      <pre className={cn("w-full", preClassName)}>
        <code>
          {lines.map(({ key, line }, index) => (
            <Fragment key={key}>
              <span className="line">{line}</span>
              {index < lines.length - 1 ? "\n" : null}
            </Fragment>
          ))}
        </code>
      </pre>
    </div>
  );
}
