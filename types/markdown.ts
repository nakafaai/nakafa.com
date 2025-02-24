import type { ComponentPropsWithoutRef } from "react";

export type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type HeadingProps = ComponentPropsWithoutRef<HeadingTag>;
export type ParagraphProps = ComponentPropsWithoutRef<"p">;
export type AnchorProps = ComponentPropsWithoutRef<"a">;
export type EmProps = ComponentPropsWithoutRef<"em">;
export type StrongProps = ComponentPropsWithoutRef<"strong">;
export type ListProps = ComponentPropsWithoutRef<"ul">;
export type ListItemProps = ComponentPropsWithoutRef<"li">;
