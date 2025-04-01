import type { ComponentPropsWithoutRef } from "react";

export type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type HeadingProps = ComponentPropsWithoutRef<HeadingTag>;
export type ParagraphProps = ComponentPropsWithoutRef<"p">;
export type AnchorProps = ComponentPropsWithoutRef<"a">;
export type EmProps = ComponentPropsWithoutRef<"em">;
export type StrongProps = ComponentPropsWithoutRef<"strong">;
export type ListProps = ComponentPropsWithoutRef<"ul">;
export type ListItemProps = ComponentPropsWithoutRef<"li">;
export type PreProps = ComponentPropsWithoutRef<"pre">;
export type CodeProps = ComponentPropsWithoutRef<"code">;
export type TableProps = ComponentPropsWithoutRef<"table">;
export type TableHeaderProps = ComponentPropsWithoutRef<"thead">;
export type TableBodyProps = ComponentPropsWithoutRef<"tbody">;
export type TableRowProps = ComponentPropsWithoutRef<"tr">;
export type TableHeadProps = ComponentPropsWithoutRef<"th">;
export type TableCellProps = ComponentPropsWithoutRef<"td">;
