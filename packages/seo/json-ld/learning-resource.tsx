import type { LearningResource, WithContext } from "schema-dts";
import type { Person } from "schema-dts";
import { JsonLd } from ".";

type Props = {
  id?: string;
  name: string;
  description: string;
  educationalLevel: string;
  datePublished: string;
  author: Person | Person[];
};

export function LearningResourceJsonLd({
  id = "learning-resource-jsonld",
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
    publisher: {
      "@type": "Organization",
      name: "PT. Nakafa Tekno Kreatif",
      logo: "https://nakafa.com/logo.svg",
      url: "https://nakafa.com",
    },
    maintainer: {
      "@type": "Organization",
      name: "PT. Nakafa Tekno Kreatif",
      logo: "https://nakafa.com/logo.svg",
      url: "https://nakafa.com",
    },
  };

  return <JsonLd jsonLd={learningResourceJsonLd} />;
}
