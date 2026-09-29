"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { parseLink } from "@/lib/requests";
import { clientIp } from "@/lib/server/auth";
import { notifyNewRequest } from "@/lib/server/notify";
import { countRecentRequests, insertRequest } from "@/lib/server/requests";

// Public form, no login: the basics against abuse live here.
const MAX_REQUESTS_PER_HOUR = 3;

const requestSchema = z.object({
  link: z.string().trim().min(1, "Please paste the link to the print you'd like.").max(600, "That link is too long."),
  message: z.string().trim().min(1, "Please tell us what colors and details you'd like.").max(3000, "Please keep the message under 3,000 characters."),
  quantity: z.number().int("Please enter a whole number.").min(1, "Quantity must be at least 1.").max(500, "Quantity is too high. Tell us in the message and we'll work it out."),
  name: z.string().trim().min(1, "Please enter your name.").max(80),
  email: z.string().trim().email("Please enter a valid email address.").max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 7 && digits <= 15;
    }, "Please enter a valid phone number."),
  /** Honeypot: hidden from people, so only bots fill it in. */
  website: z.string().max(200).optional(),
});

export type SubmitRequestInput = z.input<typeof requestSchema>;
export type SubmitRequestResult = { ok: true; id: string } | { ok: false; error: string };

export async function submitRequest(input: SubmitRequestInput): Promise<SubmitRequestResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const data = parsed.data;
  if (data.website) return { ok: false, error: "Something went wrong. Please try again." };

  const link = parseLink(data.link);
  if (!link) return { ok: false, error: "That doesn't look like a web link. Paste the address of the print's page, starting with https://" };

  try {
    const ipHash = createHash("sha256")
      .update(`${await clientIp()}|${process.env.ADMIN_SESSION_SECRET ?? ""}`)
      .digest("hex");
    if ((await countRecentRequests(ipHash, 60 * 60 * 1000)) >= MAX_REQUESTS_PER_HOUR) {
      return { ok: false, error: "You've sent several requests recently. Please wait a bit, or contact us directly." };
    }
    const request = await insertRequest({
      name: data.name,
      email: data.email,
      phone: data.phone,
      modelUrl: link.url,
      message: data.message,
      quantity: data.quantity,
      ipHash,
    });
    // Tell her after the customer has their confirmation, so a slow email service never delays them.
    after(() => notifyNewRequest(request));
    return { ok: true, id: request.id };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "We couldn't send your request just now. Please try again in a moment." };
  }
}
