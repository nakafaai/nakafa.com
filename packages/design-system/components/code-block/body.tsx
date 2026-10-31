import { codeBodyVariants } from "@repo/design-system/components/code-block/variants";
import {
  type CodeBlockData,
  useCodeBlock,
} from "@repo/design-system/lib/code-block/context";
import { Array as Arr } from "effect";
import type { HTMLAttributes, ReactNode } from "react";

/** Render-prop contract for projecting every code source into the body. */
type CodeBlockBodyProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children: (item: CodeBlockData) => ReactNode;
};

/** Maps every source into the code block's content region. */
export function CodeBlockBody({ children, ...props }: CodeBlockBodyProps) {
  const data = useCodeBlock((state) => state.data);

  return <div {...props}>{Arr.map(data, children)}</div>;
}

/** Active-source identity of one item. */
type CodeBlockItemProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

/** Renders one source only while its value is active. */
export function CodeBlockItem({
  children,
  className,
  value,
  ...props
}: CodeBlockItemProps) {
  const activeValue = useCodeBlock((state) => state.value);

  if (value !== activeValue) {
    return null;
  }

  return (
    <div className={codeBodyVariants({ className })} {...props}>
      {children}
    </div>
  );
}
