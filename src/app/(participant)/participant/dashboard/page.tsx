"use client";

import * as React from "react";
import {
  Award,
  Camera,
  Loader2,
  Plus,
  TrendingUp,
  Trophy,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PointGrowthChart } from "@/components/charts";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/states";
import {
  useMyContents,
  useMyParticipant,
  useMyRank,
  usePointHistory,
  useTopSupporters,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { formatNumber, voterStatusLabel } from "@/lib/utils";
import { ContactAdminButton } from "@/components/contact-admin";

function ChangePhotoButton({ onChanged }: { onChanged: () => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sesi tidak valid.");
        return;
      }
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("participant-photos")
        .upload(path, file, { upsert: true });
      if (upErr) {
        toast.error("Gagal upload: " + upErr.message);
        return;
      }
      const url = supabase.storage
        .from("participant-photos")
        .getPublicUrl(path).data.publicUrl;
      const res = await fetch("/api/participant/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan foto.");
        return;
      }
      toast.success("Foto diperbarui.");
      onChanged();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handle}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        Ganti Foto
      </Button>
    </>
  );
}

function ParticipantSettings({
  description,
  onSaved,
}: {
  description: string;
  onSaved: () => void;
}) {
  const [desc, setDesc] = React.useState(description);
  const [savingDesc, setSavingDesc] = React.useState(false);
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [savingPw, setSavingPw] = React.useState(false);

  async function saveDesc() {
    setSavingDesc(true);
    try {
      const res = await fetch("/api/participant/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan deskripsi.");
        return;
      }
      toast.success("Deskripsi disimpan.");
      onSaved();
    } finally {
      setSavingDesc(false);
    }
  }

  async function savePassword() {
    if (pw.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }
    setSavingPw(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        toast.error("Gagal ganti password: " + error.message);
        return;
      }
      toast.success("Password berhasil diganti.");
      setPw("");
      setPw2("");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pengaturan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Deskripsi</Label>
          <Textarea
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Ceritakan tentang dirimu..."
          />
          <Button size="sm" onClick={saveDesc} disabled={savingDesc}>
            {savingDesc && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan Deskripsi
          </Button>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label>Ganti Password</Label>
          <Input
            type="password"
            placeholder="Password baru (min. 6)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Ulangi password baru"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          <Button size="sm" onClick={savePassword} disabled={savingPw}>
            {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
            Ganti Password
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentManager() {
  const qc = useQueryClient();
  const { data: contents, isLoading } = useMyContents();
  const [kind, setKind] = React.useState<"engage" | "sound">("engage");
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function add() {
    const u = url.trim();
    if (!/^https?:\/\/.+/i.test(u)) {
      toast.error("Masukkan link yang valid (mulai http).");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      if (!p) {
        toast.error("Akun belum tertaut peserta.");
        return;
      }
      const { error } = await supabase
        .from("participant_contents")
        .insert({ participant_id: p.id, kind, url: u });
      if (error) {
        toast.error("Gagal menambah konten: " + error.message);
        return;
      }
      toast.success("Konten ditambahkan.");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["my-contents"] });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("participant_contents")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Gagal menghapus.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-contents"] });
  }

  const kindLabel = (k: string) =>
    k === "engage" ? "Like/Komen/Repost" : "Sound";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Konten Saya</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tambahkan link kontenmu. Voter akan memilih konten ini saat
          mengerjakan quest <strong>Like/Komen/Repost</strong> (engage) dan{" "}
          <strong>Pakai Sound</strong>.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm sm:w-48"
            value={kind}
            onChange={(e) => setKind(e.target.value as "engage" | "sound")}
          >
            <option value="engage">Untuk Like/Komen/Repost</option>
            <option value="sound">Untuk Sound</option>
          </select>
          <Input
            placeholder="https://www.tiktok.com/@kamu/video/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button onClick={add} disabled={busy} className="shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Tambah
          </Button>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : !contents || contents.length === 0 ? (
          <EmptyState title="Belum ada konten" />
        ) : (
          <ul className="space-y-2">
            {contents.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border p-2 text-sm"
              >
                <Badge variant="secondary" className="shrink-0">
                  {kindLabel(c.kind)}
                </Badge>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-primary hover:underline"
                >
                  {c.url}
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-destructive"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParticipantDashboard() {
  const qc = useQueryClient();
  const { data: me, isLoading, isError, refetch } = useMyParticipant();
  const { data: rank } = useMyRank(me?.id);
  const { data: history } = usePointHistory(me?.id);
  const { data: supporters } = useTopSupporters(me?.id);

  if (isLoading) return <Shell><LoadingState /></Shell>;
  if (isError) return <Shell><ErrorState onRetry={() => refetch()} /></Shell>;
  if (!me)
    return (
      <Shell>
        <EmptyState
          title="Profil peserta belum tersedia"
          description="Akun ini belum tertaut dengan data peserta. Hubungi panitia."
        />
      </Shell>
    );

  const topSupporter = supporters?.[0];

  return (
    <Shell>
      {/* Identity */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/30 p-5">
        <Avatar className="h-20 w-20 border-2">
          {me.photo_url && <AvatarImage src={me.photo_url} alt={me.name} />}
          <AvatarFallback className="text-lg">
            {me.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">{me.name}</h2>
          <p className="text-sm text-muted-foreground">{me.schools?.name}</p>
          {me.description && (
            <p className="mt-1 max-w-prose text-sm">{me.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={me.status === "active" ? "success" : "secondary"}>
            {me.status === "active" ? "Aktif" : "Nonaktif"}
          </Badge>
          <ChangePhotoButton
            onChanged={() =>
              qc.invalidateQueries({ queryKey: ["participant", "me"] })
            }
          />
          <ContactAdminButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Trophy}
          label="Total Poin"
          value={formatNumber(me.total_points)}
        />
        <StatCard
          icon={Award}
          label="Peringkat"
          value={rank ? `#${rank}` : "—"}
        />
        <StatCard
          icon={Users}
          label="Total Pendukung"
          value={formatNumber(supporters?.length ?? 0)}
        />
      </div>

      <ParticipantSettings
        description={me.description ?? ""}
        onSaved={() => refetch()}
      />

      <ContentManager />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Growth chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Perkembangan Poin
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history && history.length > 0 ? (
              <PointGrowthChart data={history} />
            ) : (
              <EmptyState title="Belum ada data poin" />
            )}
          </CardContent>
        </Card>

        {/* Top supporters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supporter Terbesar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topSupporter && (
              <div className="rounded-lg border bg-accent/5 p-3">
                <p className="text-xs text-muted-foreground">Pendukung utama</p>
                <p className="font-semibold">
                  {topSupporter.voter_name}
                  {voterStatusLabel(topSupporter.voter_status) && (
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {voterStatusLabel(topSupporter.voter_status)}
                    </span>
                  )}
                </p>
                <p className="text-sm text-accent-foreground">
                  {formatNumber(topSupporter.points)} poin
                </p>
              </div>
            )}
            {supporters && supporters.length > 0 ? (
              <ol className="space-y-2">
                {supporters.map((s, i) => (
                  <li
                    key={`${s.voter_name}-${i}`}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-muted-foreground">
                        {i + 1}.
                      </span>
                      <span className="truncate">
                        {s.voter_name}
                        {voterStatusLabel(s.voter_status) && (
                          <span className="text-muted-foreground">
                            {" · "}
                            {voterStatusLabel(s.voter_status)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium">
                      {formatNumber(s.points)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="Belum ada pendukung" />
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar
        title="Dashboard Peserta"
        links={[{ href: "/ranking", label: "Ranking" }]}
        showLogout
      />
      <main className="container space-y-6 py-8">{children}</main>
    </div>
  );
}
