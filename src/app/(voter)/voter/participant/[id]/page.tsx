"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  Link as LinkIcon,
  Loader2,
  Trophy,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyVoteToday, useQuests, useSettings } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { getFingerprint } from "@/lib/fingerprint";
import { formatNumber } from "@/lib/utils";
import type { ParticipantWithSchool } from "@/types/database";

export default function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const supabase = React.useMemo(() => createClient(), []);

  const {
    data: participant,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["participant", id],
    queryFn: async (): Promise<ParticipantWithSchool | null> => {
      const { data, error } = await supabase
        .from("participants")
        .select("*, schools(id, name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ParticipantWithSchool | null;
    },
  });

  const { data: quests } = useQuests(true);
  const { data: voteToday } = useMyVoteToday();
  const { data: settings } = useSettings();
  const eventClosed = settings ? !settings.event_open : false;
  const [voting, setVoting] = React.useState(false);

  // My submissions for this participant — to lock completed 'once' quests
  // and show the daily-done state. Rejected ones don't count.
  const { data: mySubs } = useQuery({
    queryKey: ["my-subs", id],
    queryFn: async (): Promise<
      { quest_id: string; status: string; created_at: string }[]
    > => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("submissions")
        .select("quest_id, status, created_at")
        .eq("participant_id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const alreadyVoted = voteToday?.voted ?? false;
  const votedThis = alreadyVoted && voteToday?.participant_id === id;

  async function vote() {
    setVoting(true);
    try {
      const fingerprint = await getFingerprint();
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: id, fingerprint }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal memberikan dukungan.");
        return;
      }
      toast.success("Dukungan +5 poin berhasil! 🎉");
      qc.invalidateQueries({ queryKey: ["my-vote-today"] });
      qc.invalidateQueries({ queryKey: ["participant", id] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar
        title="Detail Peserta"
        links={[{ href: "/ranking", label: "Ranking" }]}
        showLogout
      />
      <main className="container max-w-3xl space-y-6 py-8">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !participant ? (
          <EmptyState
            title="Peserta tidak ditemukan"
            description="Peserta tidak ada atau bukan dari sekolahmu."
          />
        ) : (
          <>
            {/* Profile */}
            <Card className="overflow-hidden">
              {participant.photo_url && (
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={participant.photo_url}
                    alt={participant.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2">
                    {participant.photo_url && (
                      <AvatarImage
                        src={participant.photo_url}
                        alt={participant.name}
                      />
                    )}
                    <AvatarFallback className="text-lg">
                      {participant.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold">{participant.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {participant.schools?.name}
                    </p>
                  </div>
                  <Badge variant="accent" className="shrink-0">
                    {formatNumber(participant.total_points)} poin
                  </Badge>
                </div>

                {participant.description && (
                  <p className="text-sm">{participant.description}</p>
                )}

                <Button
                  className="w-full"
                  variant={votedThis ? "secondary" : "default"}
                  disabled={alreadyVoted || voting || eventClosed}
                  onClick={vote}
                >
                  {voting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : votedThis ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Heart className="h-4 w-4" />
                  )}
                  {eventClosed
                    ? "Event ditutup"
                    : votedThis
                    ? "Sudah kamu dukung hari ini"
                    : alreadyVoted
                    ? "Sudah mendukung peserta lain hari ini"
                    : "Dukung (+5)"}
                </Button>
              </CardContent>
            </Card>

            {/* Quests for this participant */}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Trophy className="h-5 w-5 text-accent" />
                Kerjakan quest untuk memberikan poin tambahan ke{" "}
                {participant.name}
              </h3>
              {!quests || quests.length === 0 ? (
                <EmptyState title="Belum ada quest aktif" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {quests.map((q) => {
                    const subs = (mySubs ?? []).filter(
                      (s) => s.quest_id === q.id && s.status !== "rejected"
                    );
                    const today = new Date().toISOString().slice(0, 10);
                    const doneOnce = q.frequency === "once" && subs.length > 0;
                    const doneToday =
                      q.frequency === "daily" &&
                      subs.some((s) => s.created_at.slice(0, 10) === today);
                    return (
                      <QuestCard
                        key={q.id}
                        quest={q}
                        participantId={id}
                        participantName={participant.name}
                        locked={doneOnce}
                        doneToday={doneToday}
                        onDone={() =>
                          qc.invalidateQueries({ queryKey: ["my-subs", id] })
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function QuestCard({
  quest,
  participantId,
  participantName,
  locked,
  doneToday,
  onDone,
}: {
  quest: {
    id: string;
    name: string;
    description: string | null;
    point: number;
    proof_type: "link" | "file";
    frequency: "once" | "daily";
    ref_link: string | null;
    ref_image: string | null;
  };
  participantId: string;
  participantName: string;
  locked: boolean;
  doneToday: boolean;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [link, setLink] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const isLink = quest.proof_type === "link";

  function reset() {
    setFile(null);
    setLink("");
  }

  async function submit() {
    setSubmitting(true);
    try {
      let proofUrl = "";

      if (isLink) {
        const url = link.trim();
        if (!/^https?:\/\/.+/i.test(url)) {
          toast.error("Masukkan link postingan yang valid (mulai http).");
          return;
        }
        proofUrl = url;
      } else {
        if (!file) {
          toast.error("Pilih file bukti dulu.");
          return;
        }
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Sesi tidak valid.");
          return;
        }
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${quest.id}-${participantId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("quest-proofs")
          .upload(path, file, { upsert: true });
        if (upErr) {
          toast.error("Gagal mengunggah: " + upErr.message);
          return;
        }
        proofUrl = supabase.storage
          .from("quest-proofs")
          .getPublicUrl(path).data.publicUrl;
      }

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quest_id: quest.id,
          participant_id: participantId,
          proof_url: proofUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal mengirim submission.");
        return;
      }
      toast.success(
        "Bukti terkirim! Akan direview admin dulu — poin masuk setelah disetujui."
      );
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["submissions"] });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="truncate">{quest.name}</span>
          <Badge variant="accent">+{quest.point}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {quest.frequency === "daily" && (
          <Badge variant="warning">Harian · bisa diulang tiap hari</Badge>
        )}
        <p className="min-h-[2.5rem] whitespace-pre-line text-sm text-muted-foreground">
          {quest.description || "Selesaikan quest untuk poin tambahan."}
        </p>

        {/* Reference attachments (admin guidance) */}
        {quest.ref_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <a href={quest.ref_image} target="_blank" rel="noopener noreferrer">
            <img
              src={quest.ref_image}
              alt="Referensi"
              className="max-h-40 w-full rounded-md border object-cover"
            />
          </a>
        )}
        {quest.ref_link && (
          <a
            href={quest.ref_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <LinkIcon className="h-4 w-4" /> Buka arahan / akun
          </a>
        )}

        {locked ? (
          <Button size="sm" variant="secondary" className="w-full" disabled>
            <CheckCircle2 className="h-4 w-4" /> Sudah dikerjakan
          </Button>
        ) : doneToday ? (
          <Button size="sm" variant="secondary" className="w-full" disabled>
            <CheckCircle2 className="h-4 w-4" /> Sudah hari ini
          </Button>
        ) : (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="accent" className="w-full">
              {isLink ? (
                <LinkIcon className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Kerjakan Quest
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{quest.name}</DialogTitle>
              <DialogDescription>
                Untuk {participantName} · +{quest.point} poin. Bukti akan
                direview admin dulu sebelum poin masuk.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {isLink ? (
                <div className="space-y-1.5">
                  <Label>Link Postingan</Label>
                  <Input
                    type="url"
                    placeholder="https://www.instagram.com/p/..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempel link postingan video/poster yang sudah diunggah.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Screenshot Bukti Follow</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Kirim Bukti
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
