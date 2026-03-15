import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label:
        "Jika honor kegiatan dibayarkan, pimpinan dapat menugaskan karyawan membuat laporan",
      value: false,
    },
    {
      label:
        "Laporan kegiatan belum diserahkan berarti honor pimpinan tidak dibayarkan",
      value: false,
    },
    {
      label: "Jika pimpinan meminta laporan, kegiatan segera dilaksanakan",
      value: false,
    },
    {
      label:
        "Honor karyawan tidak dibayarkan berarti kegiatan belum dilaksanakan",
      value: true,
    },
    {
      label: "Jika honor tidak ada, kegiatan tidak dapat dilaksanakan",
      value: false,
    },
  ],
  en: [
    {
      label:
        "If the activity honorarium is paid, the manager can assign the employee to make a report",
      value: false,
    },
    {
      label:
        "If the activity report has not been submitted, it means the manager's honorarium is not paid",
      value: false,
    },
    {
      label:
        "If the manager asks for a report, the activity is immediately carried out",
      value: false,
    },
    {
      label:
        "If the employee's honorarium is not paid, it means the activity has not been carried out",
      value: true,
    },
    {
      label: "If there is no honorarium, the activity cannot be carried out",
      value: false,
    },
  ],
};

export default choices;
