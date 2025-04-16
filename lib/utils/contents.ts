import { ContentMetadataSchema, type Reference } from "@/types/content";
import type { ContentMetadata } from "@/types/content";
import type { Locale } from "next-intl";
import type { ComponentType } from "react";

/**
 * Gets the content for a specific file path.
 * This approach uses dynamic imports with relative paths.
 * @param path - The path to the content file.
 * @returns The content metadata and component.
 */
export async function getContent(
  locale: Locale,
  path: string
): Promise<{
  metadata: ContentMetadata;
  default: ComponentType<unknown>;
} | null> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;

    // Create a dynamic import path that works reliably with Next.js
    // Using a relative path from the location of this file (lib/utils)
    const contentModule = await import(`@/contents/${cleanPath}/${locale}.mdx`);

    const parsedMetadata = ContentMetadataSchema.parse(contentModule.metadata);

    return {
      metadata: parsedMetadata,
      default: contentModule.default,
    };
  } catch {
    return null;
  }
}

/**
 * Gets the references from the references.ts file.
 * @param path - The path to the references file.
 * @returns The references.
 */
export async function getReferences(path: string): Promise<Reference[]> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;

    // Create a dynamic import path that works reliably with Next.js
    // Using a relative path from the location of this file (lib/utils)
    const refModule = await import(`@/contents/${cleanPath}/ref.ts`);

    return refModule.references || [];
  } catch {
    return [];
  }
}
