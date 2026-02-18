import type {
  Book,
  BookFormatType,
  Organization,
  Person,
  WithContext,
} from "schema-dts";
import { JsonLd } from ".";

interface BookJsonLdProps {
  author?: Person | Organization;
  bookFormat?: BookFormatType;
  description: string;
  inLanguage: string;
  isAccessibleForFree?: boolean;
  name: string;
  position?: number;
  totalPages?: number;
  url: string;
}

/**
 * BookJsonLd component generates Schema.org Book structured data
 *
 * @example
 * ```tsx
 * // For Quran Surah
 * <BookJsonLd
 *   name="Al-Fatihah"
 *   description="The Opening"
 *   url="/quran/1"
 *   inLanguage="en"
 *   author={{ "@type": "Person", name: "Allah" }}
 *   position={1}
 *   totalPages={7}
 * />
 *
 * // For regular book
 * <BookJsonLd
 *   name="Learning JavaScript"
 *   description="A comprehensive guide"
 *   url="/books/js-guide"
 *   inLanguage="en"
 *   author={{ "@type": "Person", name: "John Doe" }}
 * />
 * ```
 */
export function BookJsonLd({
  name,
  description,
  url,
  inLanguage,
  author,
  bookFormat = "EBook",
  position,
  totalPages,
  isAccessibleForFree = true,
}: BookJsonLdProps) {
  const book: WithContext<Book> = {
    "@context": "https://schema.org",
    "@type": "Book",
    name,
    description,
    url,
    inLanguage,
    bookFormat,
    isAccessibleForFree,
    ...(author && { author }),
    ...(position !== undefined && { position }),
    ...(totalPages !== undefined && { numberOfPages: totalPages }),
  };

  return <JsonLd jsonLd={book} />;
}
