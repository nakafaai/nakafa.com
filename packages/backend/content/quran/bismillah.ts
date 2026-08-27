import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";

const unicodeMarkPattern = /^\p{Mark}$/u;
const whitespacePrefixPattern = /^\s/u;

/** Separates a signed Bismillah prefix without changing any source glyphs. */
export function splitQuranBismillahPrefix(arabic: string, bismillah: string) {
  const expectedLetters = baseLetters(bismillah);
  let matchedLetters = 0;
  let offset = 0;

  while (offset < arabic.length && matchedLetters < expectedLetters.length) {
    const codePoint = arabic.codePointAt(offset);
    if (codePoint === undefined) {
      return null;
    }
    const character = String.fromCodePoint(codePoint);
    for (const letter of baseLetters(character)) {
      if (letter !== expectedLetters[matchedLetters]) {
        return null;
      }
      matchedLetters += 1;
    }
    offset += character.length;
  }

  if (matchedLetters !== expectedLetters.length) {
    return null;
  }

  while (offset < arabic.length) {
    const codePoint = arabic.codePointAt(offset);
    if (codePoint === undefined) {
      return null;
    }
    const character = String.fromCodePoint(codePoint);
    if (!isUnicodeMark(character)) {
      break;
    }
    offset += character.length;
  }

  const remainder = arabic.slice(offset);
  if (remainder.length === 0 || !whitespacePrefixPattern.test(remainder)) {
    return null;
  }
  const verse = remainder.trimStart();
  return verse.length === 0 ? null : verse;
}

/** Projects flat Quran verses into their dedicated Bismillah presentation. */
export function separateQuranBismillah<
  const Bismillah extends { readonly arabic: string },
  const Verse extends { readonly arabic: string },
>(bismillah: Bismillah | null, verses: readonly Verse[]) {
  const [firstVerse, ...remainingVerses] = verses;
  if (bismillah === null || firstVerse === undefined) {
    return { preBismillah: null, verses };
  }
  const arabic = splitQuranBismillahPrefix(firstVerse.arabic, bismillah.arabic);
  if (arabic === null) {
    return { preBismillah: null, verses };
  }
  return {
    preBismillah: bismillah,
    verses: [{ ...firstVerse, arabic }, ...remainingVerses],
  };
}

/** Projects authenticated runtime rows while preserving every non-Arabic field. */
export function separateQuranRuntimeBismillah<
  const Bismillah extends { readonly arabic: string },
>(bismillah: Bismillah | null, verses: readonly QuranRuntimeVerse[]) {
  const [firstVerse, ...remainingVerses] = verses;
  if (bismillah === null || firstVerse === undefined) {
    return { preBismillah: null, verses };
  }
  const arabic = splitQuranBismillahPrefix(
    firstVerse.text.arabic,
    bismillah.arabic
  );
  if (arabic === null) {
    return { preBismillah: null, verses };
  }
  return {
    preBismillah: bismillah,
    verses: [
      { ...firstVerse, text: { ...firstVerse.text, arabic } },
      ...remainingVerses,
    ],
  };
}

/** Removes Unicode combining marks while preserving base-letter order. */
function baseLetters(value: string) {
  return Array.from(value.normalize("NFD")).filter(
    (character) => !isUnicodeMark(character)
  );
}

function isUnicodeMark(character: string) {
  return unicodeMarkPattern.test(character);
}
