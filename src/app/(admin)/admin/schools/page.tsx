"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useConfirm } from "@/components/confirm-dialog";
import { useSchools } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { schoolSchema, type SchoolInput } from "@/lib/validations";
import type { School } from "@/types/database";

export default function AdminSchoolsPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading, isError, refetch } = useSchools();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<School | null>(null);

  // participant count per school (to guard deletion)
  const { data: counts } = useQuery({
    queryKey: ["school-participant-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("participants")
        .select("school_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { school_id: string }[]) {
        map[r.school_id] = (map[r.school_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const form = useForm<SchoolInput>({
    resolver: zodResolver(schoolSchema),
    defaultValues: { name: "" },
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: "" });
    setOpen(true);
  }

  function openEdit(s: School) {
    setEditing(s);
    form.reset({ name: s.name });
    setOpen(true);
  }

  async function onSubmit(values: SchoolInput) {
    const supabase = createClient();
    const { error } = editing
      ? await supabase.from("schools").update({ name: values.name }).eq("id", editing.id)
      : await supabase.from("schools").insert({ name: values.name });
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Nama sekolah sudah ada."
          : "Gagal menyimpan: " + error.message
      );
      return;
    }
    toast.success(editing ? "Sekolah diperbarui." : "Sekolah ditambahkan.");
    setOpen(false);
    setEditing(null);
    form.reset({ name: "" });
    qc.invalidateQueries({ queryKey: ["schools"] });
    qc.invalidateQueries({ queryKey: ["participants"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  function remove(s: School) {
    const n = counts?.[s.id] ?? 0;
    if (n > 0) {
      toast.error(
        `Tidak bisa dihapus: masih ada ${n} peserta di sekolah ini. Pindah/hapus pesertanya dulu.`
      );
      return;
    }
    confirm({
      title: `Hapus sekolah ${s.name}?`,
      confirmText: "Hapus",
      variant: "destructive",
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await supabase.from("schools").delete().eq("id", s.id);
        if (error) {
          toast.error("Gagal menghapus: " + error.message);
          return;
        }
        toast.success("Sekolah dihapus.");
        qc.invalidateQueries({ queryKey: ["schools"] });
        qc.invalidateQueries({ queryKey: ["admin-stats"] });
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola Sekolah</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Tambah Sekolah
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Belum ada sekolah" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Sekolah</TableHead>
                  <TableHead className="text-right">Peserta</TableHead>
                  <TableHead>Ditambahkan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">
                      {counts?.[s.id] ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          title="Hapus"
                          onClick={() => remove(s)}
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
            <DialogTitle>{editing ? "Edit Sekolah" : "Tambah Sekolah"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Sekolah</Label>
              <Input {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
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
