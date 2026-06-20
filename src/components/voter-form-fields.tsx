"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoterStatus } from "@/lib/validations";

export type VoterFormData = {
  name: string;
  phone_number: string;
  email: string;
  status: VoterStatus | "";
  school: string;
  class: string;
};

export const emptyVoter: VoterFormData = {
  name: "",
  phone_number: "",
  email: "",
  status: "",
  school: "",
  class: "",
};

const STATUS_OPTIONS: { value: VoterStatus; label: string }[] = [
  { value: "teman_sekolah", label: "Teman satu sekolah" },
  { value: "guru", label: "Guru" },
  { value: "keluarga", label: "Keluarga" },
  { value: "teman_luar", label: "Teman di luar sekolah" },
];

const CLASS_OPTIONS = ["10", "11", "12", "alumni"];
const STORAGE_KEY = "fkp_voter_info";

/** Reusable controlled voter-identity fields, remembered in localStorage. */
export function useVoterForm() {
  const [data, setData] = React.useState<VoterFormData>(emptyVoter);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData({ ...emptyVoter, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const persist = React.useCallback((d: VoterFormData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, []);

  return { data, setData, persist };
}

export function VoterFormFields({
  data,
  onChange,
}: {
  data: VoterFormData;
  onChange: (d: VoterFormData) => void;
}) {
  const set = (patch: Partial<VoterFormData>) =>
    onChange({ ...data, ...patch });

  const schoolRequired = data.status === "teman_sekolah";
  // Kelas hanya untuk teman satu sekolah.
  const showClass = data.status === "teman_sekolah" && !!data.school.trim();

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Nama Lengkap</Label>
        <Input
          value={data.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nama kamu"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nomor WhatsApp</Label>
          <Input
            inputMode="tel"
            value={data.phone_number}
            onChange={(e) => set({ phone_number: e.target.value })}
            placeholder="0812xxxxxxxx"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="email@contoh.com"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select
          value={data.status || undefined}
          onValueChange={(v) =>
            set({
              status: v as VoterStatus,
              // Reset school/class if switching away from "teman sekolah"
              ...(v !== "teman_sekolah" && data.status === "teman_sekolah"
                ? { school: "", class: "" }
                : {}),
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data.status && (
        <div className="space-y-1.5">
          <Label>
            Asal Sekolah{" "}
            <span className="text-muted-foreground">
              {schoolRequired ? "" : "(opsional)"}
            </span>
          </Label>
          <Input
            value={data.school}
            onChange={(e) =>
              set({ school: e.target.value, ...(!e.target.value ? { class: "" } : {}) })
            }
            placeholder="Nama sekolah"
          />
        </div>
      )}

      {showClass && (
        <div className="space-y-1.5">
          <Label>Kelas</Label>
          <Select
            value={data.class || undefined}
            onValueChange={(v) => set({ class: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih kelas" />
            </SelectTrigger>
            <SelectContent>
              {CLASS_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "alumni" ? "Alumni" : `Kelas ${c}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
