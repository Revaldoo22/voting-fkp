import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(8, "Nomor WhatsApp minimal 8 digit")
  .max(20, "Nomor WhatsApp terlalu panjang")
  .regex(/^[0-9+\-\s().]+$/, "Nomor WhatsApp tidak valid");

// NOTE: fingerprint is attached by the client at submit time and validated
// server-side — it is intentionally NOT part of these form schemas so an
// empty initial value can't silently block React Hook Form submission.
export const voterRegisterSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    school_id: z.string().uuid("Pilih sekolah"),
    phone_number: phone,
    password: z.string().min(6, "Password minimal 6 karakter").max(72),
    confirm: z.string().min(1, "Konfirmasi password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Password tidak cocok",
    path: ["confirm"],
  });
export type VoterRegisterInput = z.infer<typeof voterRegisterSchema>;

export const voterSignInSchema = z.object({
  phone_number: phone,
  password: z.string().min(1, "Password wajib diisi"),
});
export type VoterSignInInput = z.infer<typeof voterSignInSchema>;

export const credentialLoginSchema = z.object({
  // Nama lengkap ATAU nomor WhatsApp.
  identifier: z.string().trim().min(2, "Isi nama atau nomor WhatsApp"),
  password: z.string().min(1, "Password wajib diisi"),
  expected_role: z.enum(["admin", "participant"]).optional(),
});
export type CredentialLoginInput = z.infer<typeof credentialLoginSchema>;

export const participantSchema = z
  .object({
    name: z.string().trim().min(2, "Nama peserta minimal 2 karakter").max(100),
    // Either pick an existing school (school_id) or type a new one (school_name).
    school_id: z.string().uuid().optional().or(z.literal("")),
    school_name: z.string().trim().min(2).max(150).optional().or(z.literal("")),
    phone_number: phone,
    description: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((d) => !!d.school_id || !!d.school_name, {
    message: "Pilih atau ketik nama sekolah",
    path: ["school_name"],
  });
export type ParticipantInput = z.infer<typeof participantSchema>;

export const schoolSchema = z.object({
  name: z.string().trim().min(2, "Nama sekolah minimal 2 karakter").max(150),
});
export type SchoolInput = z.infer<typeof schoolSchema>;

export const questSchema = z.object({
  name: z.string().trim().min(2, "Nama quest minimal 2 karakter").max(150),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  point: z.coerce.number().int().min(0, "Poin tidak boleh negatif").max(1000),
  status: z.enum(["active", "inactive"]).default("active"),
  proof_type: z.enum(["link", "file"]).default("file"),
  frequency: z.enum(["once", "daily"]).default("once"),
  ref_link: z.string().url("Link tidak valid").optional().or(z.literal("")),
  ref_image: z.string().url().optional().or(z.literal("")),
});
export type QuestInput = z.infer<typeof questSchema>;

export const voterStatusEnum = z.enum([
  "teman_sekolah",
  "guru",
  "keluarga",
  "teman_luar",
]);
export type VoterStatus = z.infer<typeof voterStatusEnum>;

export const voterClassEnum = z.enum(["10", "11", "12", "alumni"]);

// Shared voter identity fields (anonymous voter fills this on each action).
// School is optional; class only meaningful when a school is given.
export const voterInfoSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    phone_number: phone,
    email: z.string().trim().email("Email tidak valid").max(150),
    status: voterStatusEnum,
    school: z.string().trim().max(150).optional().or(z.literal("")),
    class: voterClassEnum.optional().or(z.literal("")),
  })
  .refine(
    (d) => d.status !== "teman_sekolah" || (!!d.school && d.school.length >= 2),
    { message: "Isi nama sekolah", path: ["school"] }
  )
  .refine((d) => d.status !== "teman_sekolah" || !!d.class, {
    message: "Pilih kelas",
    path: ["class"],
  });
export type VoterInfo = z.infer<typeof voterInfoSchema>;

// API payloads = voter info + ids/fingerprint, validated as two parts
// (voterInfoSchema is a ZodEffects from .refine and can't be .extend'd).
export type VoteInput = VoterInfo & {
  participant_id: string;
  fingerprint: string;
};

export type SubmissionInput = VoterInfo & {
  participant_id: string;
  quest_id: string;
  proof_url: string;
};
