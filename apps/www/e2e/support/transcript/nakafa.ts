import type {
  NakafaAgentContentRefSchema,
  NakafaAgentSection,
} from "@repo/contents/agent/schema/ref";
import type { Locale } from "@repo/contents/content";
import { Array as Arr } from "effect";
import {
  type Card,
  reply,
  type stored,
} from "./message";

/** The reference Nakafa gives one page, as the wire holds it. */
type Reference = typeof NakafaAgentContentRefSchema.Encoded;

/** The reference of one page: ids that follow its route, and its address. */
function reference(
  locale: Locale,
  route: string,
  section: NakafaAgentSection
): Reference {
  const path = Arr.join(route.split("/"), ":");
  const asset = `asset:fixture:${section}:${path}`;
  return {
    alignmentId: `alignment:fixture:${section}:${path}`,
    assetId: asset,
    conceptId: `concept:fixture:${section}:${path}`,
    content_id: asset,
    learningObjectId: `object:fixture:${section}:${path}`,
    lensId: `lens:fixture:${section}`,
    locale,
    route,
    section,
    url: `https://nakafa.com/${locale}/${route}`,
  };
}

/** One lesson as the content search returns it. */
function lesson(
  locale: Locale,
  route: string,
  title: string,
  description: string
) {
  return {
    ...reference(locale, route, "material"),
    description,
    excerpt: description,
    title,
  };
}

/** The card of one finished search of the lessons. */
function search(
  id: string,
  locale: Locale,
  queries: readonly string[],
  items: readonly ReturnType<typeof lesson>[]
): Card {
  return {
    data: {
      input: { limit: 10, locale, offset: 0, queries: [...queries] },
      kind: "search",
      result: {
        count: items.length,
        has_more: false,
        items: [...items],
        limit: 10,
        offset: 0,
      },
      status: "done",
    },
    id,
    type: "data-nakafa",
  };
}

/** Wraps cards in the reply of one Nakafa run. */
function replyOf(
  id: string,
  cards: readonly Card[],
  outcome?: Parameters<typeof stored>[1]
) {
  return reply({
    capability: "nakafa",
    cards,
    id,
    ...(outcome === undefined ? {} : { outcome }),
    text: "Ini materi yang cocok di Nakafa.",
  });
}

/** Two real German lessons whose titles differ only in their last words, and the longest German title. */
export const searchDe = replyOf("nakafa-de", [
  search(
    "nakafa-de-1",
    "de",
    ["Vektoraddition"],
    [
      lesson(
        "de",
        "subjects/physics/vector/analytical-addition-subtraction",
        "Vektoraddition und Vektorsubtraktion mit der analytischen Methode",
        "Vektoren über ihre x- und y-Komponenten addieren und subtrahieren sowie Betrag und Richtung der Resultierenden bestimmen."
      ),
      lesson(
        "de",
        "subjects/physics/vector/graphical-addition-subtraction",
        "Vektoraddition und Vektorsubtraktion mit grafischer Methode",
        "Addiere und subtrahiere Vektoren zeichnerisch mit Dreiecks-, Parallelogramm- und Polygonmethode sowie Gegenvektoren."
      ),
      lesson(
        "de",
        "subjects/ai-ds/linear-methods/lu-decomposition",
        "Matrizen mit dem LU Verfahren und partieller Pivotisierung zerlegen",
        "Faktorisiere eine quadratische Matrix als PA = LU und löse wiederholte lineare Systeme."
      ),
      lesson(
        "de",
        "subjects/mathematics/data-analysis-probability/binomial-distribution-function",
        "Wahrscheinlichkeitsmassenfunktion der Binomialverteilung",
        "Prüfe die Voraussetzungen eines Binomialmodells und berechne exakte Wahrscheinlichkeiten."
      ),
    ]
  ),
]);

/** Two real Indonesian lessons whose titles differ only in their last word. */
export const searchId = replyOf("nakafa-id", [
  search(
    "nakafa-id-1",
    "id",
    ["penjumlahan vektor"],
    [
      lesson(
        "id",
        "subjects/physics/vector/analytical-addition-subtraction",
        "Penjumlahan dan Pengurangan Vektor dengan Metode Analitis",
        "Menjumlahkan dan mengurangkan vektor dengan komponen x dan y, lalu menentukan besar serta arah resultan."
      ),
      lesson(
        "id",
        "subjects/physics/vector/graphical-addition-subtraction",
        "Penjumlahan dan Pengurangan Vektor dengan Metode Grafis",
        "Menentukan resultan vektor dengan metode segitiga, jajargenjang, poligon, dan pengurangan melalui vektor negatif."
      ),
    ]
  ),
]);

/** The most lessons one search holds: ten, of which the card shows five first. */
export const searchMany = replyOf("nakafa-many", [
  search(
    "nakafa-many-1",
    "id",
    ["peluang"],
    Arr.makeBy(10, (index) =>
      lesson(
        "id",
        `subjects/mathematics/probability/lesson-${index + 1}`,
        `Peluang Kejadian ${index + 1}`,
        "Menghitung peluang kejadian dengan ruang sampel."
      )
    )
  ),
]);

/** A search that found no lesson. */
export const searchNone = replyOf(
  "nakafa-none",
  [search("nakafa-none-1", "id", ["xqzv"], [])],
  "empty"
);

/** The card of a page that Nina read, with the title and description the page signs. */
function read(
  id: string,
  locale: Locale,
  route: string,
  title: string,
  description?: string
): Card {
  return {
    data: {
      input: {
        content_ref: `https://nakafa.com/${locale}/${route}`,
      },
      kind: "content",
      result: {
        ...reference(locale, route, "material"),
        ...(description === undefined ? {} : { description }),
        title,
      },
      status: "done",
    },
    id,
    type: "data-nakafa",
  };
}

/** A German page whose title starts with a word of 33 letters. */
export const content = replyOf("nakafa-content", [
  read(
    "nakafa-content-1",
    "de",
    "subjects/mathematics/data-analysis-probability/binomial-distribution-function",
    "Wahrscheinlichkeitsmassenfunktion der Binomialverteilung",
    "Prüfe die Voraussetzungen eines Binomialmodells und berechne exakte Wahrscheinlichkeiten mit seiner Wahrscheinlichkeitsmassenfunktion."
  ),
]);

/** An Indonesian page with the longest description of the lessons: 256 characters. */
export const contentLong = replyOf("nakafa-long", [
  read(
    "nakafa-long-1",
    "id",
    "subjects/mathematics/exponential-logarithm/function-exploration",
    "Model Fungsi Eksponensial",
    "Pohon penularan ideal menunjukkan perbedaan antara jumlah orang yang baru terinfeksi pada satu fase dan total orang yang baru terinfeksi selama beberapa fase. Perbandingan fungsi eksponensial, linear, dan logaritmik disertai penjelasan tentang batas model."
  ),
]);

/** A page whose signed metadata has no description. */
export const contentBare = replyOf("nakafa-bare", [
  read(
    "nakafa-bare-1",
    "id",
    "subjects/physics/vector/property",
    "Sifat Vektor"
  ),
]);

/** The card of a Quran reference in German. */
function quran(
  id: string,
  surah: number,
  name: string,
  meaning: string,
  verses: readonly [number, number]
): Card {
  const [from, to] = verses;
  return {
    data: {
      input: {
        from_verse: from,
        include_tafsir: false,
        locale: "de",
        surah,
        ...(to === from ? {} : { to_verse: to }),
      },
      kind: "quran",
      result: {
        ...reference("de", `quran/${surah}`, "quran"),
        from_verse: from,
        locale: "de",
        meaning: { locale: "de", text: meaning },
        name,
        revelation: "Medinan",
        to_verse: to,
        verse_count: to - from + 1,
      },
      status: "done",
    },
    id,
    type: "data-nakafa",
  };
}

/** One verse of the second surah, and a range of three verses of the surah with the longest name. */
export const quranRefs = replyOf("nakafa-quran", [
  quran("nakafa-quran-1", 2, "Al-Baqara", "Die Kuh", [255, 255]),
  quran("nakafa-quran-2", 63, "Al-Munaafiqoon", "Die Heuchler", [9, 11]),
]);

/** The card of a search that failed. */
export const nakafaSearchFailed: Card = {
  data: {
    error: "Unable to search Nakafa content.",
    input: { limit: 10, locale: "de", offset: 0, queries: ["Vektor"] },
    kind: "search",
    status: "error",
  },
  id: "nakafa-failed-1",
  type: "data-nakafa",
};

/** A search that failed. */
export const failedNakafaSearch = replyOf(
  "nakafa-failed",
  [nakafaSearchFailed],
  "failed"
);
