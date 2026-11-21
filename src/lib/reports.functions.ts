import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const CATEGORIES = [
  "broken_ramp",
  "ramp_ends_at_step",
  "blocked_pathway",
  "damaged_pavement",
  "locked_entrance",
  "lift_not_working",
  "missing_signage",
  "narrow_pathway",
  "other",
] as const;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const REPORTS_PER_HOUR = 5;

const uuidOrEmpty = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().uuid().nullable());

const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().min(min).max(max).nullable());

const ReportSchema = z
  .object({
    category: z.enum(CATEGORIES),
    description: z.string().trim().min(10, "Please describe the problem in at least 10 characters.").max(2000),
    location_text: z.string().trim().max(300).default(""),
    node_id: uuidOrEmpty,
    lat: optionalNumber(-90, 90),
    lng: optionalNumber(-180, 180),
    occurred_at: z.string().trim().min(1),
    anonymous: z.enum(["true", "false"]),
  })
  .refine((v) => v.node_id || (v.lat !== null && v.lng !== null) || v.location_text.length >= 3, {
    message: "Please choose a place, pick a point on the map, or describe the location.",
  });

function magicMatches(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp")
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45;
  return false;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Public barrier-report submission. Runs on the server so it can rate-limit
 * anonymous submissions, validate photos and never trust the browser.
 */
export const submitBarrierReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Invalid form submission");
    return data;
  })
  .handler(async ({ data }) => {
    const raw = Object.fromEntries(
      ["category", "description", "location_text", "node_id", "lat", "lng", "occurred_at", "anonymous"].map((k) => [
        k,
        String(data.get(k) ?? ""),
      ]),
    );
    const parsed = ReportSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Please check the form." };
    }
    const input = parsed.data;
    const occurred = new Date(input.occurred_at);
    if (Number.isNaN(occurred.getTime()) || occurred.getTime() > Date.now() + 5 * 60_000) {
      return { ok: false as const, error: "The date and time cannot be in the future." };
    }

    const photo = data.get("photo");
    let photoFile: File | null = null;
    if (photo instanceof File && photo.size > 0) {
      if (!ALLOWED_PHOTO_TYPES.includes(photo.type as (typeof ALLOWED_PHOTO_TYPES)[number])) {
        return { ok: false as const, error: "Photos must be JPG, PNG or WebP images." };
      }
      if (photo.size > MAX_PHOTO_BYTES) return { ok: false as const, error: "Photos must be 5 MB or smaller." };
      photoFile = photo;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const request = getRequest();

    // Optional signed-in reporter (bearer token attached by the client middleware)
    let reporterId: string | null = null;
    const auth = request?.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
      reporterId = u.user?.id ?? null;
    }

    // Rate limit by hashed IP (raw IP is never stored)
    const ip =
      request?.headers.get("cf-connecting-ip") ??
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const ipHash = await sha256(`clearroute:${ip}`);
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("report_rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= REPORTS_PER_HOUR) {
      return { ok: false as const, error: "Too many reports from this connection. Please try again in an hour." };
    }

    let photoBytes: Uint8Array | null = null;
    if (photoFile) {
      photoBytes = new Uint8Array(await photoFile.arrayBuffer());
      if (!magicMatches(photoBytes, photoFile.type)) {
        return { ok: false as const, error: "That file does not look like a valid image." };
      }
    }

    const anonymous = input.anonymous === "true";
    const { data: report, error } = await supabaseAdmin
      .from("barrier_reports")
      .insert({
        category: input.category,
        description: input.description,
        location_text: input.location_text || null,
        node_id: input.node_id,
        lat: input.lat,
        lng: input.lng,
        occurred_at: occurred.toISOString(),
        is_anonymous: anonymous || !reporterId,
        reporter_id: anonymous ? null : reporterId,
      })
      .select("id, code")
      .single();
    if (error || !report) {
      console.error("report insert failed", error);
      return { ok: false as const, error: "We could not save your report. Please try again." };
    }
    await supabaseAdmin.from("report_rate_limits").insert({ ip_hash: ipHash });

    let photoSaved = false;
    if (photoFile && photoBytes) {
      const ext = photoFile.type === "image/png" ? "png" : photoFile.type === "image/webp" ? "webp" : "jpg";
      const path = `${report.id}/photo-${crypto.randomUUID()}.${ext}`;
      const up = await supabaseAdmin.storage.from("report-photos").upload(path, photoBytes, {
        contentType: photoFile.type,
        upsert: false,
      });
      if (!up.error) {
        await supabaseAdmin
          .from("report_attachments")
          .insert({ report_id: report.id, storage_path: path, kind: "photo", uploaded_by: reporterId });
        photoSaved = true;
      } else {
        console.error("photo upload failed", up.error);
      }
    }

    return { ok: true as const, code: report.code, photoSaved, linkedToAccount: !anonymous && !!reporterId };
  });
