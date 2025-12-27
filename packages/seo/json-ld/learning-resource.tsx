import type { LearningResource, Person, WithContext } from "schema-dts";
import { JsonLd } from ".";
import { ORGANIZATION } from "./constants";

interface Props {
  name: string;
  description: string;
  educationalLevel: string;
  datePublished: string;
  author: Person | Person[];
}

export function LearningResourceJsonLd({
  name,
  description,
  educationalLevel,
  datePublished,
  author,
}: Props) {
  const learningResourceJsonLd: WithContext<LearningResource> = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name,
    description,
    educationalLevel,
    datePublished,
    author: Array.isArray(author) ? author : [author],
    publisher: ORGANIZATION,
    maintainer: ORGANIZATION,
  };

  return <JsonLd jsonLd={learningResourceJsonLd} />;
}
