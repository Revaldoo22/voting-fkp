"use client";

import * as React from "react";
import { Award, Camera, Loader2, TrendingUp, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PointGrowthChart } from "@/components/charts";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/states";
import {
  useMyParticipant,
  useMyRank,
  usePointHistory,
  useTopSupporters,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";
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
                <p className="font-semibold">{topSupporter.voter_name}</p>
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
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-4 text-muted-foreground">{i + 1}.</span>
                      {s.voter_name}
                    </span>
                    <span className="font-medium">
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
