import type { ExercisesChoices } from "@repo/contents/_types/exercises/choices";

const choices: ExercisesChoices = {
  id: [
    {
      label: "memberikan penjelasan atau tanggapan.",
      value: true,
    },
    {
      label: "menyangkal sesuatu hal.",
      value: false,
    },
    {
      label: "kegiatan menawar sesuatu.",
      value: false,
    },
    {
      label: "membicarakan sesuatu hal.",
      value: false,
    },
    {
      label: "berdiskusi tentang sesuatu.",
      value: false,
    },
  ],
  en: [
    {
      label: "providing an explanation or response.",
      value: true,
    },
    {
      label: "denying something.",
      value: false,
    },
    {
      label: "the activity of bargaining for something.",
      value: false,
    },
    {
      label: "talking about something.",
      value: false,
    },
    {
      label: "discussing something.",
      value: false,
    },
  ],
};

export default choices;
