"use client";

import { Response } from "@repo/design-system/components/ai/response";

/**
 * Renders bounded artifact titles with the same math pipeline as AI messages.
 */
export function ArtifactTitle({
  artifactId,
  children,
}: {
  artifactId: string;
  children: string;
}) {
  return (
    <Response
      allowedImagePrefixes={[]}
      allowedLinkPrefixes={[]}
      className="[&_p]:my-0"
      id={`${artifactId}-title`}
    >
      {children}
    </Response>
  );
}

/**
 * Renders bounded artifact description copy with math support and no raw HTML.
 */
export function ArtifactDescription({
  artifactId,
  children,
}: {
  artifactId: string;
  children: string;
}) {
  return (
    <Response
      allowedImagePrefixes={[]}
      allowedLinkPrefixes={[]}
      className="text-muted-foreground text-sm [&_p]:my-0"
      id={`${artifactId}-description`}
    >
      {children}
    </Response>
  );
}
