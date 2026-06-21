"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { useConfirm } from "@/components/confirm-dialog";
import { useQuests } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
import { questSchema, type QuestInput } from "@/lib/validations";
import type { Quest } from "@/types/database";

const empty: QuestInput = {
  name: "",
  description: "",
  point: 10,
  status: "active",
  proof_type: "file",
  frequency: "once",
  ref_link: "",
  ref_image: "",
};

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function AdminQuestsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading, isError, refetch } = useQuests();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Quest | null>(null);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [refImageFile, setRefImageFile] = React.useState<File | null>(null);

  const filtered = React.useMemo(
    () =>
      (data ?? []).filter((q) =>
        statusFilter === "all" ? true : q.status === statusFilter
      ),
    [data, statusFilter]
  );

  const form = useForm<QuestInput>({
    resolver: zodResolver(questSchema),
    defaultValues: empty,
  });

  function openCreate() {
    setEditing(null);
    form.reset(empty);
    setRefImageFile(null);
    setOpen(true);
  }

  function openEdit(q: Quest) {
    setEditing(q);
    form.reset({
      name: q.name,
      description: q.description ?? "",
      point: q.point,
      status: q.status,
      proof_type: q.proof_type,
      frequency: q.frequency,
      ref_link: q.ref_link ?? "",
      ref_image: q.ref_image ?? "",
    });
    setRefImageFile(null);
    setOpen(true);
  }

  async function onSubmit(values: QuestInput) {
    const supabase = createClient();

    // Upload a new reference image if one was chosen.
    let refImage = values.ref_image || null;
    if (refImageFile) {
      const img = await compressImage(refImageFile);
      const ext = img.name.split(".").pop();
      const path = `quest-ref/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("participant-photos")
        .upload(path, img, { upsert: true });
      if (upErr) {
        toast.error("Gagal upload gambar referensi: " + upErr.message);
        return;
      }
      refImage = supabase.storage
        .from("participant-photos")
        .getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name: values.name,
      description: values.description || null,
      point: values.point,
      status: values.status,
      proof_type: values.proof_type,
      frequency: values.frequency,
      ref_link: values.ref_link || null,
      ref_image: refImage,
    };
    const { error } = editing
      ? await supabase.from("quests").update(payload).eq("id", editing.id)
      : await supabase.from("quests").insert(payload);
    if (error) {
      toast.error("Gagal menyimpan quest: " + error.message);
      return;
    }
    toast.success(editing ? "Quest diperbarui." : "Quest ditambahkan.");
    setOpen(false);
    setEditing(null);
    form.reset(empty);
    setRefImageFile(null);
    qc.invalidateQueries({ queryKey: ["quests"] });
  }

  async function toggleStatus(id: string, current: string) {
    const supabase = createClient();
    const next = current === "active" ? "inactive" : "active";
    const { error } = await supabase
      .from("quests")
      .update({ status: next })
      .eq("id", id);
    if (error) {
      toast.error("Gagal mengubah status.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["quests"] });
  }

  function remove(q: Quest) {
    confirm({
      title: `Hapus quest ${q.name}?`,
      description: "Submission terkait quest ini ikut terhapus.",
      confirmText: "Hapus",
      variant: "destructive",
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase.from("quests").delete().eq("id", q.id);
        if (error) {
          toast.error("Gagal menghapus: " + error.message);
          return;
        }
        toast.success("Quest dihapus.");
        qc.invalidateQueries({ queryKey: ["quests"] });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola Quest</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah Quest
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="active">Aktif</TabsTrigger>
          <TabsTrigger value="inactive">Nonaktif</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            data && data.length > 0
              ? "Tidak ada quest pada filter ini"
              : "Belum ada quest"
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quest</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead>Bukti</TableHead>
                  <TableHead>Frekuensi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>
                      <p className="font-medium">{q.name}</p>
                      <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                        {q.description || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      +{q.point}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {q.proof_type === "link" ? "Link" : "File"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={q.frequency === "daily" ? "warning" : "outline"}
                      >
                        {q.frequency === "daily" ? "Harian" : "Sekali"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={q.status === "active" ? "success" : "secondary"}
                      >
                        {q.status === "active" ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleStatus(q.id, q.status)}
                        >
                          {q.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(q)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => remove(q)}
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

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Quest" : "Tambah Quest"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Quest</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi</Label>
              <Textarea rows={3} {...form.register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Poin</Label>
                <Input type="number" {...form.register("point")} />
                {form.formState.errors.point && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.point.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Frekuensi</Label>
                <select className={selectCls} {...form.register("frequency")}>
                  <option value="once">Sekali (selesai permanen)</option>
                  <option value="daily">Harian (ulang tiap hari)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Bukti</Label>
              <select className={selectCls} {...form.register("proof_type")}>
                <option value="file">Upload File (screenshot)</option>
                <option value="link">Link Postingan (video / poster)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select className={selectCls} {...form.register("status")}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>

            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium">Arahan / Referensi (opsional)</p>
              <div className="space-y-1.5">
                <Label>Link Arahan (akun sosmed / contoh postingan)</Label>
                <Input
                  type="url"
                  placeholder="https://instagram.com/stekom"
                  {...form.register("ref_link")}
                />
                {form.formState.errors.ref_link && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.ref_link.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Gambar Referensi (mis. contoh poster)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRefImageFile(e.target.files?.[0] ?? null)}
                />
                {editing?.ref_image && !refImageFile && (
                  <p className="text-xs text-muted-foreground">
                    Sudah ada gambar. Pilih file baru untuk mengganti.
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editing ? "Simpan Perubahan" : "Simpan"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
