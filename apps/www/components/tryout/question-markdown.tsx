"use client";

import { Response } from "@repo/design-system/components/ai/response";

const MDX_MODULE_LINE_PATTERN = /^\s*(?:import|export)\s.+$/;

interface TryoutQuestionMarkdownProps {
  body: string;
  id: string;
}

/** Renders a Convex-stored question body through the hardened markdown surface. */
export function TryoutQuestionMarkdown({
  body,
  id,
}: TryoutQuestionMarkdownProps) {
  return (
    <Response className="text-sm" id={id}>
      {stripMdxModuleLines(body)}
    </Response>
  );
}

function stripMdxModuleLines(body: string) {
  return body
    .split("\n")
    .filter((line) => !MDX_MODULE_LINE_PATTERN.test(line))
    .join("\n")
    .trim();
}
