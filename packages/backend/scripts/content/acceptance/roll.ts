import { Array as Arr, Option, String as Str } from "effect";

/** How many of each record a full school holds. */
export const FULL_SCHOOL = {
  classes: 100,
  exams: 100,
  guardians: 500,
  invites: 300,
  students: 1000,
  teachers: 200,
} as const;

/** The subjects of a cohort's classes. Five classes of twenty cohorts make the full school's hundred. */
export const SUBJECTS = [
  "Bahasa Indonesia",
  "Biologi",
  "Fisika",
  "Kimia",
  "Matematika",
] as const;

/** The cohorts that hold the students: seven of each of the first two grades of an SMA, and six of the last. */
export const COHORT_COUNT = 20;
const COHORTS_PER_GRADE = 7;
const GRADES = [
  { grade: 10, roman: "X" },
  { grade: 11, roman: "XI" },
  { grade: 12, roman: "XII" },
] as const;

/** First and last names of coprime counts, so each index up to their product names one person. */
const FIRST_NAMES = Str.split(
  "Adi Agus Ahmad Aisyah Andi Anisa Ayu Bagas Bambang Bayu Budi Cahya Citra Dewi Dian Dimas Eka Fajar Farah Fitri Galih Gita Hadi Hana Indah Intan Joko Kartika Lestari Made Maya Nabila Nadia Nur Putri Rafi Rani Rizki Sari Sinta Tari Tio Umar Vina Wahyu Yusuf Zahra",
  " "
);
const LAST_NAMES = Str.split(
  "Aditya Akbar Anggraini Ardiansyah Firmansyah Gunawan Habibie Hakim Handayani Hartono Hidayat Hutapea Irawan Kurniawan Kusuma Lubis Mahendra Maulana Nasution Nugroho Pangestu Permata Pratama Prasetyo Purnama Putra Rahayu Rahman Ramadhan Saputra Setiawan Siregar Siswanto Sitompul Susanto Syahputra Tanjung Utami Wahyudi Wibowo Wijaya Yulianto Zulkarnain",
  " "
);

/** Every this many people one holds the longest name a person may have, so no column hides it. */
const LONG_NAME_EVERY = 97;
const LONG_NAME_END =
  "Raden Mas Aryo Wicaksono Prawiro Hadikusumo Tjokroaminoto Soerjopranoto Mangkunegoro Kertanegara";
const NAME_LIMIT = 120;

/** The name of the person of one index: every name of the roll differs from every other. */
export const personName = (index: number) => {
  const pair = `${Arr.getUnsafe(FIRST_NAMES, index % FIRST_NAMES.length)} ${Arr.getUnsafe(LAST_NAMES, index % LAST_NAMES.length)}`;
  return index % LONG_NAME_EVERY === 0
    ? `${pair} ${LONG_NAME_END}`.slice(0, NAME_LIMIT).trim()
    : pair;
};

/** The grade and the name of the cohort of one index: X-1 to X-7, XI-1 to XI-7, XII-1 to XII-6. */
export const cohortOf = (index: number) => {
  const place = Math.min(
    Math.floor(index / COHORTS_PER_GRADE),
    GRADES.length - 1
  );
  const { grade, roman } = Option.getOrThrow(Arr.get(GRADES, place));
  return { grade, name: `${roman}-${index - place * COHORTS_PER_GRADE + 1}` };
};

/** The indexes of the school's people of each kind, in the order they are written. */
export const peopleOf = (count: typeof FULL_SCHOOL) => {
  const guardiansFrom = count.students + count.teachers;
  const invitedFrom = guardiansFrom + count.guardians;
  return {
    guardians: Arr.makeBy(count.guardians, (i) => guardiansFrom + i),
    invited: Arr.makeBy(count.invites, (i) => invitedFrom + i),
    students: Arr.makeBy(count.students, (i) => i),
    teachers: Arr.makeBy(count.teachers, (i) => count.students + i),
  };
};
