import type { Locale } from "next-intl";
import type { LlmsSection } from "@/lib/llms/constants";

export interface LlmsFullDocument {
  bytes: number;
  locale: Locale;
  section: LlmsSection;
  segments: string[];
  text: string;
}

export interface LlmsFullShard {
  bytes: number;
  children: LlmsFullShard[];
  documentCount: number;
  href: string;
  locale: Locale;
  oversized: boolean;
  path: string;
  prefixParts: string[];
  section: LlmsSection | undefined;
  sourceBytes: number;
  text: string;
  title: string;
}

export interface LlmsFullTextArtifact {
  bytes: number;
  path: string;
  text: string;
}
