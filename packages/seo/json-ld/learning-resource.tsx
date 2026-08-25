import { JsonLd } from "@repo/seo/json-ld";
import { ORGANIZATION } from "@repo/seo/json-ld/constants";
import type { LearningResource, Person, WithContext } from "schema-dts";

interface Props {
  author: Person | Person[];
  dateModified?: string;
  datePublished: string;
  description?: string;
  educationalLevel: string;
  name: string;
}

export function LearningResourceJsonLd({
  name,
  description,
  educationalLevel,
  dateModified,
  datePublished,
  author,
}: Props) {
  const learningResourceJsonLd: WithContext<LearningResource> = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name,
    ...(description === undefined ? {} : { description }),
    educationalLevel,
    datePublished,
    ...(dateModified === undefined ? {} : { dateModified }),
    author: Array.isArray(author) ? author : [author],
    publisher: ORGANIZATION,
    maintainer: ORGANIZATION,
  };

  return <JsonLd jsonLd={learningResourceJsonLd} />;
}
