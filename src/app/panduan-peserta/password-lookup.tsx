"use client";

import * as React from "react";
import { Copy, KeyRound, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LOOKUP_URL = process.env.NEXT_PUBLIC_PASSWORD_LOOKUP_URL ?? "";

type Row = { name: string; password: string };

export function PasswordLookup() {
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [rows, setRows] = React.useState<Row[] | null>(null);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const term = q.trim();
    if (term.length < 2) {
      toast.error("Ketik minimal 2 huruf nama.");
      return;
    }
    if (!LOOKUP_URL) {
      toast.error("Fitur belum dikonfigurasi. Hubungi panitia.");
      return;
    }
    setBusy(true);
    setRows(null);
    try {
      const res = await fetch(`${LOOKUP_URL}?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error ?? "Gagal mengambil data.");
        return;
      }
      setRows(data.results as Row[]);
      if ((data.results as Row[]).length === 0) {
        toast.message("Nama tidak ditemukan. Coba kata lain atau hubungi panitia.");
      }
    } catch {
      toast.error("Gagal terhubung. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  function copy(r: Row) {
    navigator.clipboard.writeText(`Nama: ${r.name}\nPassword: ${r.password}`);
    toast.success("Disalin.");
  }

  return (
    <div className="space-y-4 text-left">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Ketik nama kamu..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" disabled={busy} className="shrink-0">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Cari Password
        </Button>
      </form>

      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg border bg-background p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.name}</p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span className="font-mono">{r.password}</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => copy(r)}
              >
                <Copy className="h-4 w-4" /> Salin
              </Button>
            </li>
          ))}
        </ul>
      )}

      {rows && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nama tidak ditemukan. Pastikan ejaan benar atau hubungi panitia.
        </p>
      )}
    </div>
  );
}
