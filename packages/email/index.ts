import { keys } from "@repo/email/keys";
import { Resend } from "resend";

export const resend = new Resend(keys().RESEND_TOKEN);
