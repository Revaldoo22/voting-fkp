"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDoneContentIds,
  useParticipantContents,
  useQuests,
  useSettings,
} from "@/lib/queries";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFingerprint } from "@/lib/fingerprint";
import { formatNumber } from "@/lib/utils";
import { voterInfoSchema } from "@/lib/validations";
import {
  VoterFormFields,
  useVoterForm,
  type VoterFormData,
} from "@/components/voter-form-fields";
import type { ParticipantWithSchool, Quest } from "@/types/database";

export default function PublicParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = React.useMemo(() => createClient(), []);
  const voter = useVoterForm();
  const { data: quests } = useQuests(true);
  const { data: settings } = useSettings();
  const eventClosed = settings ? !settings.event_open : false;

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

  return (
    <div className="min-h-screen">
      <Navbar links={[{ href: "/ranking", label: "Ranking" }]} />
      <main className="container max-w-3xl space-y-6 py-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </Button>

        {eventClosed && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm font-medium text-destructive">
            {settings?.closed_message ?? "Event sedang ditutup."}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !participant ? (
          <EmptyState title="Peserta tidak ditemukan" />
        ) : (
          <>
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
                      <AvatarImage src={participant.photo_url} alt={participant.name} />
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

                <VoteDialog
                  participantId={id}
                  participantName={participant.name}
                  voter={voter}
                  disabled={eventClosed}
                  onVoted={() => refetch()}
                />
              </CardContent>
            </Card>

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
                  {quests.map((q) => (
                    <QuestCard
                      key={q.id}
                      quest={q}
                      participantId={id}
                      participantName={participant.name}
                      voter={voter}
                      disabled={eventClosed}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

type VoterCtx = ReturnType<typeof useVoterForm>;

function validateVoter(data: VoterFormData): string | null {
  const r = voterInfoSchema.safeParse(data);
  return r.success ? null : r.error.issues[0]?.message ?? "Data tidak lengkap";
}

function VoteDialog({
  participantId,
  participantName,
  voter,
  disabled,
  onVoted,
}: {
  participantId: string;
  participantName: string;
  voter: VoterCtx;
  disabled: boolean;
  onVoted: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const err = validateVoter(voter.data);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const fingerprint = await getFingerprint();
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...voter.data, participant_id: participantId, fingerprint }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal memberikan dukungan.");
        return;
      }
      voter.persist(voter.data);
      toast.success(`Dukungan +5 untuk ${participantName} berhasil! 🎉`);
      setOpen(false);
      onVoted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={disabled}>
          <Heart className="h-4 w-4" />
          {disabled ? "Event ditutup" : "Dukung (+5)"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dukung {participantName}</DialogTitle>
          <DialogDescription>
            Isi data dirimu untuk memberikan dukungan (+5 poin). 1 dukungan per
            peserta per hari.
          </DialogDescription>
        </DialogHeader>
        <VoterFormFields data={voter.data} onChange={voter.setData} />
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Kirim Dukungan
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function QuestCard({
  quest,
  participantId,
  participantName,
  voter,
  disabled,
}: {
  quest: Quest;
  participantId: string;
  participantName: string;
  voter: VoterCtx;
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [link, setLink] = React.useState("");
  const [contentId, setContentId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const qc = useQueryClient();
  const isLink = quest.proof_type === "link";
  const needsContent = !!quest.content_kind;

  // Participant contents to choose from (only for content-kind quests).
  const { data: contents } = useParticipantContents(
    needsContent ? participantId : undefined
  );
  const allOptions = (contents ?? []).filter(
    (c) => c.kind === quest.content_kind
  );
  // Which of those this voter already completed (by email).
  const { data: doneIds } = useDoneContentIds(
    needsContent ? participantId : "",
    needsContent ? quest.id : "",
    voter.data.email
  );
  const doneSet = new Set(doneIds ?? []);
  const remaining = allOptions.filter((c) => !doneSet.has(c.id));

  async function submit() {
    const err = validateVoter(voter.data);
    if (err) {
      toast.error(err);
      return;
    }
    if (needsContent && !contentId) {
      toast.error("Pilih konten peserta dulu.");
      return;
    }
    setBusy(true);
    try {
      let proofUrl = "";
      if (isLink) {
        if (!/^https?:\/\/.+/i.test(link.trim())) {
          toast.error("Masukkan link postingan yang valid.");
          return;
        }
        proofUrl = link.trim();
      } else {
        if (!file) {
          toast.error("Pilih file bukti dulu.");
          return;
        }
        const supabase = createClient();
        const ext = file.name.split(".").pop();
        const path = `${Date.now()}-${Math.round(file.size)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("quest-proofs")
          .upload(path, file, { upsert: false });
        if (upErr) {
          toast.error("Gagal mengunggah: " + upErr.message);
          return;
        }
        proofUrl = supabase.storage.from("quest-proofs").getPublicUrl(path).data
          .publicUrl;
      }

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...voter.data,
          participant_id: participantId,
          quest_id: quest.id,
          proof_url: proofUrl,
          content_id: needsContent ? contentId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal mengirim submission.");
        return;
      }
      voter.persist(voter.data);
      toast.success("Bukti terkirim! Akan direview admin sebelum poin masuk.");
      setOpen(false);
      setFile(null);
      setLink("");
      setContentId("");
      qc.invalidateQueries({ queryKey: ["done-content"] });
    } finally {
      setBusy(false);
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
        {needsContent && allOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Peserta belum menambahkan konten untuk quest ini.
          </p>
        )}
        {needsContent && allOptions.length > 0 && remaining.length === 0 && (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Semua konten sudah dikerjakan
          </Badge>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="accent"
              className="w-full"
              disabled={
                disabled ||
                (needsContent &&
                  (allOptions.length === 0 || remaining.length === 0))
              }
            >
              {isLink ? <LinkIcon className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {disabled ? "Event ditutup" : "Kerjakan Quest"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{quest.name}</DialogTitle>
              <DialogDescription>
                Untuk {participantName} · +{quest.point} poin. Direview admin
                dulu sebelum poin masuk.
              </DialogDescription>
            </DialogHeader>

            {needsContent && (
              <div className="space-y-1.5">
                <Label>
                  Pilih konten peserta{" "}
                  {quest.content_kind === "sound"
                    ? "(sumber sound)"
                    : "(untuk like/komen/repost)"}
                </Label>
                <div className="space-y-2">
                  {allOptions.map((c, i) => {
                    const done = doneSet.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 rounded-md border p-2 text-sm ${
                          done
                            ? "opacity-60"
                            : contentId === c.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name={`content-${quest.id}`}
                          disabled={done}
                          checked={contentId === c.id}
                          onChange={() => setContentId(c.id)}
                        />
                        <span className="min-w-0 flex-1 font-medium">
                          Konten {i + 1}
                        </span>
                        {done ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Sudah
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" /> Buka
                            </a>
                          </Button>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Buka kontennya,{" "}
                  {quest.content_kind === "sound"
                    ? "buat konten pakai sound itu, lalu kirim link kontenmu."
                    : "lakukan like/komen/repost, lalu upload screenshot."}
                </p>
              </div>
            )}

            <VoterFormFields data={voter.data} onChange={voter.setData} />
            {isLink ? (
              <div className="space-y-1.5">
                <Label>Link Postingan</Label>
                <Input
                  type="url"
                  placeholder="https://www.instagram.com/p/..."
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>File Bukti (screenshot)</Label>
                <Input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Kirim Bukti
            </Button>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
