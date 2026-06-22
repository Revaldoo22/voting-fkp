"use client";

import * as React from "react";
import {
  Award,
  Camera,
  ChevronDown,
  Heart,
  Link as LinkIcon,
  Loader2,
  Music,
  Plus,
  Settings,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useSupporterCount,
  useTopSupporters,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-compress";
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
      const img = await compressImage(file);
      const ext = img.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("participant-photos")
        .upload(path, img, { upsert: true });
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

function Section({
  title,
  desc,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  desc?: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border bg-card [&[open]_.chev]:rotate-180"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          {desc && (
            <span className="block text-xs text-muted-foreground">{desc}</span>
          )}
        </span>
        <ChevronDown className="chev h-5 w-5 shrink-0 text-muted-foreground transition-transform" />
      </summary>
      <div className="border-t p-4">{children}</div>
    </details>
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
    <Section
      title="Pengaturan Akun"
      desc="Ubah deskripsi & password kamu"
      icon={Settings}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Tentang Kamu</Label>
          <Textarea
            rows={3}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Tulis sedikit tentang dirimu, biar pendukung kenal kamu..."
          />
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={saveDesc}
            disabled={savingDesc}
          >
            {savingDesc && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label>Ganti Password</Label>
          <Input
            type="password"
            placeholder="Password baru (minimal 6 huruf/angka)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Ketik ulang password baru"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={savePassword}
            disabled={savingPw}
          >
            {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
            Ganti Password
          </Button>
        </div>
      </div>
    </Section>
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
    <Section
      title="Link Konten Aku"
      desc="Link TikTok/IG kamu untuk quest pendukung"
      icon={LinkIcon}
    >
      <div className="space-y-4">
        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          Tempel link kontenmu di sini. Nanti pendukung pilih konten ini waktu
          ngerjain quest <strong>Like/Komen/Repost</strong> atau{" "}
          <strong>Pakai Sound</strong>. Makin banyak konten, makin banyak poin
          yang bisa masuk.
        </p>
        <div className="space-y-2">
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as "engage" | "sound")}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engage">
                <span className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" />
                  Untuk di-Like/Komen/Repost
                </span>
              </SelectItem>
              <SelectItem value="sound">
                <span className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-accent" />
                  Untuk dipakai Sound-nya
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="https://www.tiktok.com/@kamu/video/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button onClick={add} disabled={busy} className="w-full">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Tambah Link
          </Button>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : !contents || contents.length === 0 ? (
          <EmptyState title="Belum ada link konten" />
        ) : (
          <ul className="space-y-2">
            {contents.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
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
      </div>
    </Section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tone?: "primary" | "amber" | "emerald";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
  } as const;
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
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
  const { data: supporters } = useTopSupporters(me?.id, 100);
  const { data: supporterCount } = useSupporterCount(me?.id);
  const [showAllSupporters, setShowAllSupporters] = React.useState(false);

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
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-blue-600 to-blue-700 p-5 text-white shadow-sm sm:p-6">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
          <Avatar className="h-24 w-24 shrink-0 border-4 border-white/30 shadow-lg">
            {me.photo_url && <AvatarImage src={me.photo_url} alt={me.name} />}
            <AvatarFallback className="bg-white/20 text-2xl text-white">
              {me.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {rank && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-semibold backdrop-blur">
                  Peringkat #{rank}
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  me.status === "active" ? "bg-emerald-400/30" : "bg-white/20"
                }`}
              >
                {me.status === "active" ? "Aktif" : "Nonaktif"}
              </span>
            </div>
            <h2 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
              {me.name}
            </h2>
            <p className="text-sm text-white/80">{me.schools?.name}</p>
            {me.description && (
              <p className="mt-1 line-clamp-2 text-sm text-white/70">
                {me.description}
              </p>
            )}
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto [&_a]:w-full [&_a]:justify-center [&_a]:border-white/40 [&_a]:bg-white/10 [&_a]:text-white [&_a:hover]:bg-white/20 [&_button]:w-full [&_button]:justify-center [&_button]:border-white/40 [&_button]:bg-white/10 [&_button]:text-white [&_button:hover]:bg-white/20">
            <ChangePhotoButton
              onChanged={() =>
                qc.invalidateQueries({ queryKey: ["participant", "me"] })
              }
            />
            <ContactAdminButton />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Trophy}
          tone="amber"
          label="Total Poin"
          value={formatNumber(me.total_points)}
        />
        <StatCard
          icon={Award}
          tone="primary"
          label="Peringkat"
          value={rank ? `#${rank}` : "—"}
        />
        <StatCard
          icon={Users}
          tone="emerald"
          label="Total Pendukung"
          value={formatNumber(supporterCount ?? 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Growth chart */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Perkembangan Poin
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden">
            {history && history.length > 0 ? (
              <PointGrowthChart data={history} />
            ) : (
              <EmptyState title="Belum ada data poin" />
            )}
          </CardContent>
        </Card>

        {/* Top supporters */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Supporter Terbesar</CardTitle>
            <p className="text-xs text-muted-foreground">
              {formatNumber(supporterCount ?? 0)} total pendukung
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {topSupporter && (
              <div className="rounded-lg border bg-accent/5 p-3">
                <p className="text-xs text-muted-foreground">Pendukung utama</p>
                <p className="truncate font-semibold">
                  {topSupporter.voter_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {voterStatusLabel(topSupporter.voter_status)}
                </p>
                <p className="text-sm font-medium text-accent-foreground">
                  {formatNumber(topSupporter.points)} poin
                </p>
              </div>
            )}
            {supporters && supporters.length > 0 ? (
              <>
                <ol
                  className={`space-y-2 ${
                    showAllSupporters ? "max-h-96 overflow-y-auto pr-1" : ""
                  }`}
                >
                  {(showAllSupporters ? supporters : supporters.slice(0, 5)).map(
                    (s, i) => (
                      <li
                        key={`${s.voter_name}-${i}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="w-5 shrink-0 text-muted-foreground">
                            {i + 1}.
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{s.voter_name}</span>
                            {voterStatusLabel(s.voter_status) && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {voterStatusLabel(s.voter_status)}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium">
                          {formatNumber(s.points)}
                        </span>
                      </li>
                    )
                  )}
                </ol>
                {supporters.length > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAllSupporters((v) => !v)}
                  >
                    {showAllSupporters
                      ? "Tampilkan lebih sedikit"
                      : `Tampilkan semua (${formatNumber(supporters.length)})`}
                  </Button>
                )}
              </>
            ) : (
              <EmptyState title="Belum ada pendukung" />
            )}
          </CardContent>
        </Card>
      </div>

      <ContentManager />

      <ParticipantSettings
        description={me.description ?? ""}
        onSaved={() => refetch()}
      />
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
