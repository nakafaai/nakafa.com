import type { Page } from "@playwright/test";
import { Array as Arr, Effect, Option } from "effect";
import {
  type Card,
  cited,
  type Part,
  ran,
  reply,
  said,
  stored,
  working,
} from "./message";

type SearchCard = Extract<Card, { type: "data-web-search" }>["data"];
type PageCard = Extract<Card, { type: "data-scrape-url" }>["data"];

/** A host of 33 characters, the longest the fixtures give a source. */
export const LONG_HOST = "ppid.regional-office.example.test";

/** One page title that is a file name: 63 characters and no place to break. */
const FILE_NAME =
  "Modul_Matematika_Kelas_XII_Bab_Integral_TakTentu_Versi_2026.pdf";

/** A title of 200 characters, the way a page that stuffs its title writes one. */
const LONG_TITLE =
  "Turunan Fungsi Aljabar dan Trigonometri: Rumus Lengkap, Contoh Soal, Pembahasan dan Latihan Mandiri untuk Siswa Kelas 11 SMA dan Persiapan UTBK SNBT Matematika 2026 | Portal Belajar Matematika Daring.";

/**
 * An address of 220 characters on the long host. A page that has no description
 * of its own can give its address, so one result gives it as its description.
 */
export const LONG_ADDRESS = `https://${LONG_HOST}/unduhan/matematika/kelas-12/semester-1/bab-3/integral-tak-tentu/modul-pembelajaran-lengkap-contoh-soal-pembahasan-revisi-2026.pdf?unduh=1&sumber=beranda&kelas=12&mapel=matematika`;

/**
 * Two titles on one host that share all but their last word. Each is long
 * enough to take two lines at 320 pixels, which the test measures, so a title
 * cut to one line would hide the word that tells them apart.
 */
export const LESSON_TITLE =
  "Turunan Fungsi Aljabar untuk Kelas 11 SMA - Materi";
export const EXERCISE_TITLE =
  "Turunan Fungsi Aljabar untuk Kelas 11 SMA - Latihan";

/** The hosts whose icon the fixtures break or paint black. */
const BROKEN_HOST = "broken-icon.example.test";
const BLACK_HOST = "monochrome.example.test";

/**
 * 32 by 32 icons with an alpha channel, written once with a PNG encoder: a
 * black ring with a dot on a transparent ground, and a solid blue disc.
 */
const BLACK_ICON =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAdElEQVR42u1XWw4AIAjq/pemIzRFhVVu/hXi8kFrfYsbDi4L3EYEpEuDUyQygGUkWBDqfuU7prCqqzmEhwECmMw+hBvNnjmLDkCacEWv4xN4gsBYEY63oXwQWYxi+TKyWMdyQWIhySxEqYUst/iY2HzN7rQNkbdesGCBTDQAAAAASUVORK5CYII=";
const BLUE_ICON =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAZklEQVR42u3Xyw0AIAhEQZqxMsu3CK3ADwKyMUvi+c1JUYSjnFJbX520cBhEG3aFWOMmhFf8CuEdVyGi4seIVEB0fItIBbyKTxEEEEBAOoA3IV9DmIUEYiWDWEoh1nKIjwnM1+zbGcYp4pygR+XJAAAAAElFTkSuQmCC";

/** The origin of the icons that scraped pages name for themselves. */
const ICON_ORIGIN = "https://icons.example.test";

/** One result of a web search: its link, title and what the page says about itself. */
function found(url: string, title: string, description: string) {
  return {
    citation: `[${new URL(url).hostname}](${url})`,
    content: "",
    description,
    title,
    url,
  };
}

/** The card of one executed web search, with the sites it was limited to, if any. */
function search(
  id: string,
  query: string,
  sources: readonly ReturnType<typeof found>[],
  status: SearchCard["status"] = "done",
  sites: readonly string[] = []
): Card {
  return {
    data: {
      queries: [query],
      ...(sites.length === 0 ? {} : { sites: [...sites] }),
      sources: [...sources],
      status,
    },
    id,
    type: "data-web-search",
  };
}

/** The card of one page that research read, or tried to. */
function page(id: string, data: PageCard): Card {
  return { data, id, type: "data-scrape-url" };
}

/** Wraps cards in the reply of one research run. */
function replyOf(
  id: string,
  cards: readonly Card[],
  outcome?: Parameters<typeof stored>[1]
) {
  return reply({
    capability: "deepResearch",
    cards,
    id,
    ...(outcome === undefined ? {} : { outcome }),
    text: "Ini yang saya temukan di web.",
  });
}

/** Two results on one host whose titles differ only in their last word, and the odd titles around them. */
export const sameHost = replyOf("web-same-host", [
  search("web-same-host-1", "turunan fungsi", [
    found(
      `https://${LONG_HOST}/materi/turunan-fungsi`,
      LESSON_TITLE,
      "Penjelasan turunan fungsi aljabar dengan rumus dasar dan contoh soal."
    ),
    found(
      `https://${LONG_HOST}/latihan/turunan-fungsi`,
      EXERCISE_TITLE,
      "Kumpulan soal turunan fungsi beserta pembahasannya."
    ),
    found(
      "https://www.example.org/turunan",
      "",
      "Ringkasan aturan turunan dan aturan rantai."
    ),
    found(
      "https://belajar.example.test/turunan-fungsi",
      LONG_TITLE,
      "Rumus turunan, contoh soal dan pembahasan untuk kelas 11."
    ),
    found(
      `https://${LONG_HOST}/unduhan/modul-integral.pdf`,
      FILE_NAME,
      "Modul pembelajaran integral tak tentu untuk kelas XII."
    ),
    found(LONG_ADDRESS, "Modul Integral Tak Tentu Kelas XII", LONG_ADDRESS),
    found(
      `https://${BROKEN_HOST}/turunan`,
      "Turunan Fungsi dan Penerapannya",
      "Penerapan turunan pada masalah nilai maksimum dan minimum."
    ),
    found(
      `https://${BLACK_HOST}/turunan`,
      "Turunan Fungsi untuk Pemula",
      "Pengantar turunan dengan gambar dan contoh sederhana."
    ),
  ]),
]);

/** Five titles on probability: the web results of the card below, which its news results repeat. */
const PROBABILITY_TITLES = [
  "Peluang Kejadian Majemuk",
  "Rumus Peluang Gabungan Dua Kejadian",
  "Kejadian Saling Lepas dan Tidak Saling Lepas",
  "Contoh Soal Peluang Kejadian Majemuk",
  "Peluang Bersyarat dan Kejadian Bebas",
];

/** The most results one search card holds: five web results and five news results. */
export const manyResults = replyOf("web-many", [
  search(
    "web-many-1",
    "peluang kejadian majemuk",
    Arr.map(
      Arr.appendAll(PROBABILITY_TITLES, PROBABILITY_TITLES),
      (title, index) =>
        found(
          `https://sumber-${index + 1}.example.test/peluang`,
          title,
          "Penjelasan singkat dengan contoh soal."
        )
    )
  ),
]);

/** A search that returned one result. */
export const oneResult = replyOf("web-one", [
  search("web-one-1", "teorema Pythagoras", [
    found(
      "https://id.example.test/teorema-pythagoras",
      "Teorema Pythagoras",
      "Hubungan antara sisi-sisi segitiga siku-siku."
    ),
  ]),
]);

/** A search that returned nothing. */
export const noResults = replyOf(
  "web-none",
  [search("web-none-1", "xqzv teorema", [])],
  "empty"
);

/** The card of a search that the provider failed. */
export const webSearchFailed: Card = {
  data: {
    error: "Failed to search the web. Please try again.",
    queries: ["integral tak tentu"],
    sources: [],
    status: "error",
  },
  id: "web-failed-1",
  type: "data-web-search",
};

/** A search that the provider failed, beside one that worked. */
export const failedWebSearch = replyOf(
  "web-failed",
  [
    webSearchFailed,
    search("web-failed-2", "integral substitusi", [
      found(
        "https://integral.example.test/substitusi",
        "Integral dengan Substitusi",
        "Langkah menyelesaikan integral dengan substitusi."
      ),
    ]),
  ],
  "partial"
);

/** The first of the sites below, whose results the fixture shows. */
const SITE_DATA =
  "pusat-data-dan-teknologi-informasi-pendidikan.kemendikdasmen.example.test";

/** A site whose first label has 63 characters, the most a label allows (RFC 1035, section 2.3.4). */
export const SITE_LONG_LABEL =
  "pusat-layanan-pendidikan-dan-kebudayaan-wilayah-timur-indonesia.example.test";

/**
 * The hostnames a search is limited to. One call names five at most
 * (`webSearchMaxSites`), and these are long: each is more than 60 characters,
 * and the third has the longest label a name allows.
 */
export const LIMIT_SITES = [
  SITE_DATA,
  "perpustakaan-digital-universitas-negeri-yogyakarta.repository.example.test",
  SITE_LONG_LABEL,
  "badan-standar-kurikulum-dan-asesmen-pendidikan.regional-timur.example.test",
  "dinas-pendidikan-provinsi-nusa-tenggara-timur.kupang.example.test",
];

/** A name that is not ASCII, as `URL` gives it and the contract holds it: in punycode. */
export const PUNYCODE_SITE = "xn--mnchen-3ya.example.test";

/**
 * A search limited to five long sites, and one that the provider failed, limited
 * to a long site that the model named twice and a punycode one.
 */
export const limited = replyOf(
  "web-limited",
  [
    search(
      "web-limited-1",
      "kurikulum merdeka",
      [
        found(
          `https://${SITE_DATA}/kurikulum-merdeka`,
          "Kurikulum Merdeka",
          "Panduan penerapan kurikulum merdeka di satuan pendidikan."
        ),
      ],
      "done",
      LIMIT_SITES
    ),
    {
      data: {
        error: "Failed to search the web. Please try again.",
        queries: ["asesmen nasional"],
        sites: [SITE_LONG_LABEL, PUNYCODE_SITE, SITE_LONG_LABEL],
        sources: [],
        status: "error",
      },
      id: "web-limited-2",
      type: "data-web-search",
    },
  ],
  "partial"
);

/** A search limited to the same five sites that still runs. */
export const limitedLoading = [
  working(
    "deepResearch",
    "web-limited-loading",
    stored([
      search(
        "limited-loading",
        "kurikulum merdeka",
        [],
        "loading",
        LIMIT_SITES
      ),
    ])
  ),
] satisfies readonly Part[];

/** An address of 220 characters and a name in Arabic script, each as the query of a search. */
export const queries = replyOf("web-queries", [
  search("web-queries-1", LONG_ADDRESS, [
    found(
      "https://ar.example.test/dalil",
      "نور الهدى عبد الرحمن",
      "وصف الصفحة بالعربية."
    ),
  ]),
  search("web-queries-2", "نور الهدى عبد الرحمن", [
    found(
      "https://id.example.test/nur-al-huda",
      "Nur al-Huda",
      "Profil singkat."
    ),
  ]),
]);

/** Pages that research read: one failed, two read, one without a title. */
export const pages = [
  ran(
    "deepResearch",
    "scrape-all",
    stored([
      page("scrape-error", {
        content: "",
        error: "The page could not be read.",
        status: "error",
        url: "https://blocked.example.test/materi",
      }),
      page("scrape-done", {
        content: "Turunan adalah laju perubahan fungsi.",
        description: "Penjelasan turunan fungsi aljabar dengan contoh.",
        favicon: `${ICON_ORIGIN}/blue.png`,
        status: "done",
        title: "Materi Turunan Fungsi",
        url: `https://${LONG_HOST}/materi/turunan-fungsi`,
      }),
      page("scrape-untitled", {
        content: "Teks halaman.",
        favicon: `${ICON_ORIGIN}/missing.png`,
        status: "done",
        url: "https://www.example.org/turunan",
      }),
      page("scrape-black", {
        content: "Teks halaman.",
        description: "Halaman dengan ikon hitam.",
        favicon: `${ICON_ORIGIN}/black.png`,
        status: "done",
        title: "Turunan Fungsi untuk Pemula",
        url: `https://${BLACK_HOST}/turunan`,
      }),
    ])
  ),
  said("Saya sudah membaca halaman itu."),
] satisfies readonly Part[];

/** A run that is still reading a page and searching: its cards load. */
export const loading = [
  working(
    "deepResearch",
    "web-loading",
    stored([
      page("loading-page", {
        content: "",
        status: "loading",
        url: `https://${LONG_HOST}/materi/turunan-fungsi`,
      }),
      search("loading-search", "turunan fungsi", [], "loading"),
    ])
  ),
] satisfies readonly Part[];

/** Answers from before research cited its sources in cards: they hold only a title and a link. */
export const legacy = [
  said("Turunan adalah laju perubahan sebuah fungsi."),
  cited(
    "legacy-1",
    "https://id.wikipedia.org/wiki/Turunan",
    "Turunan - Wikipedia bahasa Indonesia, ensiklopedia bebas yang lengkap"
  ),
  cited("legacy-2", "https://www.example.org/kalkulus", ""),
  cited(
    "legacy-3",
    "https://vi.example.test/dang-thi-ngoc-han",
    "Đặng Thị Ngọc Hân"
  ),
  cited(
    "legacy-4",
    "https://th.example.test/kalkulus",
    "แคลคูลัสเบื้องต้น ฟังก์ชันอนุพันธ์"
  ),
  cited("legacy-5", "https://ar.example.test/dalil", "نور الهدى عبد الرحمن"),
] satisfies readonly Part[];

/** The icon a host gets from the icon service the sources call, or none. */
function iconOf(host: string) {
  if (host === BROKEN_HOST) {
    return Option.none();
  }
  return Option.some(host === BLACK_HOST ? BLACK_ICON : BLUE_ICON);
}

/**
 * Answers the icon requests of the sources. A source asks the icon service for
 * its host, and a scraped page names an icon of its own. The fixtures give one
 * host a missing icon and another a black mark on a transparent ground.
 */
export const serveIcons = Effect.fn("NakafaE2E.serveIcons")(function* (
  page_: Page
) {
  const png = (body: string) => ({
    body: Buffer.from(body, "base64"),
    contentType: "image/png",
    status: 200,
  });
  yield* Effect.promise(() =>
    page_.route("https://www.google.com/s2/favicons**", (route) => {
      const asked = new URL(route.request().url()).searchParams.get(
        "domain_url"
      );
      const host = asked === null ? "" : new URL(asked).hostname;
      return Option.match(iconOf(host), {
        onNone: () => route.fulfill({ status: 404 }),
        onSome: (body) => route.fulfill(png(body)),
      });
    })
  );
  yield* Effect.promise(() =>
    page_.route(`${ICON_ORIGIN}/**`, (route) => {
      const name = new URL(route.request().url()).pathname;
      if (name === "/black.png") {
        return route.fulfill(png(BLACK_ICON));
      }
      if (name === "/blue.png") {
        return route.fulfill(png(BLUE_ICON));
      }
      return route.fulfill({ status: 404 });
    })
  );
});
