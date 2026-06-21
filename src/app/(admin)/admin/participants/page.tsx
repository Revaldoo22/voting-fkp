"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Loader2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/states";
import { useConfirm } from "@/components/confirm-dialog";
import {
  useParticipantPointLog,
  useParticipants,
  useSchools,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { participantSchema, type ParticipantInput } from "@/lib/validations";
import { formatNumber } from "@/lib/utils";
import type { ParticipantWithSchool } from "@/types/database";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function AdminParticipantsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: schools } = useSchools();
  const { data: participants, isLoading, isError, refetch } = useParticipants();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ParticipantWithSchool | null>(null);
  const [detail, setDetail] = React.useState<ParticipantWithSchool | null>(null);
  const [creds, setCreds] = React.useState<{
    name: string;
    phone_number?: string;
    password: string;
  } | null>(null);
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [schoolText, setSchoolText] = React.useState("");
  const [status, setStatus] = React.useState<"active" | "inactive">("active");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 15;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = participants ?? [];
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.schools?.name?.toLowerCase().includes(q) ||
        p.profiles?.phone_number?.includes(q)
    );
  }, [participants, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  React.useEffect(() => setPage(1), [search]);

  // Password dialog (admin sets a participant's password).
  const [pwTarget, setPwTarget] = React.useState<ParticipantWithSchool | null>(
    null
  );
  const [pwValue, setPwValue] = React.useState("");
  const [pwBusy, setPwBusy] = React.useState(false);

  const form = useForm<ParticipantInput>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      name: "",
      school_id: "",
      school_name: "",
      phone_number: "",
      description: "",
    },
  });

  React.useEffect(() => {
    const match = schools?.find(
      (s) => s.name.trim().toLowerCase() === schoolText.trim().toLowerCase()
    );
    form.setValue("school_id", match?.id ?? "", { shouldValidate: true });
    form.setValue("school_name", match ? "" : schoolText, { shouldValidate: true });
  }, [schoolText, schools, form]);

  function openCreate() {
    setEditing(null);
    form.reset({
      name: "",
      school_id: "",
      school_name: "",
      phone_number: "",
      description: "",
    });
    setSchoolText("");
    setStatus("active");
    setPhoto(null);
    setOpen(true);
  }

  function openEdit(p: ParticipantWithSchool) {
    setEditing(p);
    form.reset({
      name: p.name,
      school_id: p.school_id,
      school_name: "",
      // Phone isn't editable here; use a schema-valid placeholder so the
      // form validates. The PATCH endpoint ignores phone anyway.
      phone_number: "00000000",
      description: p.description ?? "",
    });
    setSchoolText(p.schools?.name ?? "");
    setStatus(p.status);
    setPhoto(null);
    setOpen(true);
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photo) return null;
    const supabase = createClient();
    const compressed = await compressImage(photo);
    const ext = compressed.name.split(".").pop();
    const path = `${Date.now()}-${Math.round(Number(compressed.size))}.${ext}`;
    const { error } = await supabase.storage
      .from("participant-photos")
      .upload(path, compressed, { upsert: false });
    if (error) {
      toast.error("Gagal upload foto: " + error.message);
      throw error;
    }
    return supabase.storage.from("participant-photos").getPublicUrl(path).data
      .publicUrl;
  }

  async function onSubmit(values: ParticipantInput) {
    let photo_url: string | null = null;
    try {
      photo_url = await uploadPhoto();
    } catch {
      return;
    }

    if (editing) {
      // EDIT
      const res = await fetch(`/api/admin/participants/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          school_id: values.school_id || undefined,
          school_name: values.school_name || undefined,
          description: values.description || null,
          status,
          ...(photo_url ? { photo_url } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan.");
        return;
      }
      toast.success("Peserta diperbarui.");
    } else {
      // CREATE
      const res = await fetch("/api/admin/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, photo_url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal membuat peserta.");
        return;
      }
      setCreds({ name: values.name, ...data.credentials });
      toast.success("Peserta berhasil dibuat.");
    }

    setOpen(false);
    setEditing(null);
    invalidate();
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["participants"] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    qc.invalidateQueries({ queryKey: ["schools"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  function openPassword(p: ParticipantWithSchool) {
    setPwTarget(p);
    setPwValue("");
  }

  // Submit password change. If pwValue empty → server auto-generates.
  async function submitPassword(mode: "manual" | "generate") {
    if (!pwTarget) return;
    if (mode === "manual" && pwValue.trim().length < 6) {
      toast.error("Password baru minimal 6 karakter.");
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch(`/api/admin/participants/${pwTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "manual"
            ? { new_password: pwValue.trim() }
            : { reset_password: true }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal mengubah password.");
        return;
      }
      const name = pwTarget.name;
      setPwTarget(null);
      setPwValue("");
      setCreds({ name, password: data.password });
    } finally {
      setPwBusy(false);
    }
  }

  function remove(p: ParticipantWithSchool) {
    confirm({
      title: `Hapus peserta ${p.name}?`,
      description:
        "Akun login, vote, dan submission peserta ini ikut terhapus. Tindakan tidak bisa dibatalkan.",
      confirmText: "Hapus",
      variant: "destructive",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/participants/${p.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Gagal menghapus.");
          return;
        }
        toast.success("Peserta dihapus.");
        invalidate();
      },
    });
  }

  function copyCreds() {
    if (!creds) return;
    navigator.clipboard.writeText(
      `Login Peserta — ${creds.name}\n${
        creds.phone_number ? `Nomor WA: ${creds.phone_number}\n` : ""
      }Password: ${creds.password}`
    );
    toast.success("Kredensial disalin.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola Peserta</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah Peserta
        </Button>
      </div>

      <Input
        placeholder="Cari nama peserta, sekolah, atau nomor WA..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <CardSkeletonGrid />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !participants || participants.length === 0 ? (
        <EmptyState
          title="Belum ada peserta"
          description="Klik 'Tambah Peserta' untuk membuat peserta pertama."
        />
      ) : paged.length === 0 ? (
        <EmptyState title="Tidak ada peserta cocok pencarian" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Nomor WA</TableHead>
                  <TableHead>Sekolah</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-2 text-left hover:underline"
                        onClick={() => setDetail(p)}
                      >
                        <Avatar className="h-8 w-8">
                          {p.photo_url && (
                            <AvatarImage src={p.photo_url} alt={p.name} />
                          )}
                          <AvatarFallback>
                            {p.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{p.name}</span>
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {p.profiles?.phone_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.schools?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(p.total_points)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={p.status === "active" ? "success" : "secondary"}
                      >
                        {p.status === "active" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Atur password"
                          onClick={() => openPassword(p)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          title="Hapus"
                          onClick={() => remove(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Hal {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {editing ? "Edit Peserta" : "Tambah Peserta"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah data peserta. Nomor WA tidak bisa diubah; gunakan Reset Password untuk ganti password."
                : "Sistem akan membuat password login untuk peserta ini."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Peserta</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Sekolah</Label>
              <Input
                list="school-options"
                placeholder="Pilih dari daftar atau ketik sekolah baru"
                value={schoolText}
                onChange={(e) => setSchoolText(e.target.value)}
                autoComplete="off"
              />
              <datalist id="school-options">
                {schools?.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Sekolah baru otomatis dibuat. Sekolah sama digabung.
              </p>
              {form.formState.errors.school_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.school_name.message}
                </p>
              )}
            </div>

            {!editing && (
              <div className="space-y-1.5">
                <Label>Nomor WhatsApp (untuk login peserta)</Label>
                <Input
                  placeholder="0812xxxxxxxx"
                  inputMode="tel"
                  {...form.register("phone_number")}
                />
                {form.formState.errors.phone_number && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.phone_number.message}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea rows={3} {...form.register("description")} />
            </div>

            {editing && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  className={selectCls}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "active" | "inactive")
                  }
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Foto Peserta {editing && "(kosongkan jika tidak ganti)"}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editing ? "Simpan Perubahan" : "Buat Peserta"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Participant detail — supporters */}
      <ParticipantDetailDialog
        participant={detail}
        onClose={() => setDetail(null)}
      />

      {/* Set / change password */}
      <Dialog
        open={!!pwTarget}
        onOpenChange={(o) => {
          if (!o && !pwBusy) {
            setPwTarget(null);
            setPwValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" /> Atur Password
            </DialogTitle>
            <DialogDescription>
              Password untuk <strong>{pwTarget?.name}</strong>. Password lama
              tidak dapat ditampilkan (tersimpan terenkripsi). Buat password baru
              atau generate otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Password Baru</Label>
              <Input
                type="text"
                placeholder="Ketik password baru (min. 6 karakter)"
                value={pwValue}
                onChange={(e) => setPwValue(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => submitPassword("manual")}
                disabled={pwBusy}
              >
                {pwBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Password
              </Button>
              <Button
                variant="outline"
                onClick={() => submitPassword("generate")}
                disabled={pwBusy}
              >
                Generate Otomatis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials reveal (create or password reset) */}
      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kredensial Peserta ✅</DialogTitle>
            <DialogDescription>
              Simpan & bagikan ke peserta. Password hanya ditampilkan sekali.
            </DialogDescription>
          </DialogHeader>
          {creds && (
            <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Nama:</span>{" "}
                <strong>{creds.name}</strong>
              </p>
              {creds.phone_number && (
                <p>
                  <span className="text-muted-foreground">Nomor WA:</span>{" "}
                  <strong>{creds.phone_number}</strong>
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Password:</span>{" "}
                <strong className="font-mono">{creds.password}</strong>
              </p>
            </div>
          )}
          <Button variant="outline" onClick={copyCreds}>
            <Copy className="h-4 w-4" /> Salin Kredensial
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ParticipantDetailDialog({
  participant,
  onClose,
}: {
  participant: ParticipantWithSchool | null;
  onClose: () => void;
}) {
  const { data: log, isLoading } = useParticipantPointLog(participant?.id);
  const [sourceFilter, setSourceFilter] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    setSourceFilter("");
    setFrom("");
    setTo("");
    setSearch("");
  }, [participant?.id]);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Distinct sources (Vote harian + nama quest) for the dropdown.
  const sources = React.useMemo(() => {
    const set = new Set<string>();
    (log ?? []).forEach((r) => set.add(r.source));
    return Array.from(set);
  }, [log]);

  const q = search.trim().toLowerCase();
  const rows = React.useMemo(() => {
    return (log ?? []).filter((r) => {
      if (sourceFilter && r.source !== sourceFilter) return false;
      const d = r.created_at.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (
        q &&
        !(
          r.voter_name?.toLowerCase().includes(q) ||
          r.voter_phone?.includes(q)
        )
      )
        return false;
      return true;
    });
  }, [log, sourceFilter, from, to, q]);

  const shownPoints = rows.reduce((s, r) => s + r.points, 0);
  const sel =
    "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Dialog open={!!participant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{participant?.name}</DialogTitle>
          <DialogDescription>
            {participant?.schools?.name ?? "—"} · Total{" "}
            {formatNumber(participant?.total_points ?? 0)} poin · Rincian poin
            masuk
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Cari voter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full sm:w-40"
          />
          <select
            className={sel}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">Semua sumber</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-36"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-36"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Tidak ada poin masuk pada filter ini" />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {formatNumber(rows.length)} entri · {formatNumber(shownPoints)} poin
            </p>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Badge
                        variant={r.kind === "vote" ? "secondary" : "accent"}
                        className="shrink-0"
                      >
                        {r.source}
                      </Badge>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.voter_name} · {r.voter_phone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-primary">
                    +{r.points}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
