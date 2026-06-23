"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import { MaintenanceOverlay } from "@/components/maintenance-overlay";
import {
  ArrowLeft,
  Heart,
  Link as LinkIcon,
  Loader2,
  Plus,
  Share2,
  Star,
  Trophy,
  Upload,
  X,
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
import { compressImage } from "@/lib/image-compress";
import { formatNumber } from "@/lib/utils";
import { voterInfoSchema } from "@/lib/validations";
import {
  VoterFormFields,
  useVoterForm,
  type VoterFormData,
} from "@/components/voter-form-fields";
import { useConfirm } from "@/components/confirm-dialog";
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
      <MaintenanceOverlay />
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
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  <Image
                    src={participant.photo_url}
                    alt={participant.name}
                    fill
                    sizes="(max-width:768px) 100vw, 768px"
                    className="object-cover"
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

                <ShareButton name={participant.name} />

                <div className="grid gap-2 sm:grid-cols-2">
                  <VoteDialog
                    kind="daily5"
                    participantId={id}
                    participantName={participant.name}
                    voter={voter}
                    disabled={eventClosed}
                    onVoted={() => refetch()}
                  />
                  <VoteDialog
                    kind="fav20"
                    participantId={id}
                    participantName={participant.name}
                    voter={voter}
                    disabled={eventClosed}
                    onVoted={() => refetch()}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Vote harian +5 (semua peserta) · Vote favorit +20 (maks 10
                  peserta/hari)
                </p>
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

function ShareButton({ name }: { name: string }) {
  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Dukung ${name} di Festival Karakter Pelajar STEKOM! 🔥`;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        return;
      } catch {
        return; // user batal — jangan tampilkan error
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Link disalin! Bagikan ke teman-temanmu.");
    } catch {
      toast.error("Gagal menyalin link.");
    }
  }

  return (
    <Button variant="outline" className="w-full" onClick={share}>
      <Share2 className="h-4 w-4" /> Bagikan Profil
    </Button>
  );
}

function VoteDialog({
  kind,
  participantId,
  participantName,
  voter,
  disabled,
  onVoted,
}: {
  kind: "daily5" | "fav20";
  participantId: string;
  participantName: string;
  voter: VoterCtx;
  disabled: boolean;
  onVoted: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const confirm = useConfirm();
  const isFav = kind === "fav20";
  const pts = isFav ? 20 : 5;

  function submit() {
    const err = validateVoter(voter.data);
    if (err) {
      toast.error(err);
      return;
    }
    confirm({
      title: "Pastikan data kamu benar",
      description: `Nama: ${voter.data.name}\nNomor WhatsApp: ${voter.data.phone_number}\nEmail: ${voter.data.email}\n\nData ini dipakai panitia untuk menghubungimu jika kamu mendapatkan reward. Pastikan benar — tidak bisa diubah setelah dikirim.`,
      confirmText: "Saya Yakin, Kirim",
      onConfirm: doSubmit,
    });
  }

  async function doSubmit() {
    setBusy(true);
    try {
      const fingerprint = await getFingerprint();
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...voter.data,
          participant_id: participantId,
          fingerprint,
          kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal memberikan dukungan.");
        return;
      }
      voter.persist(voter.data);
      toast.success(`Dukungan +${pts} untuk ${participantName} berhasil! 🎉`);
      setOpen(false);
      onVoted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          variant={isFav ? "accent" : "default"}
          disabled={disabled}
        >
          {isFav ? <Star className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
          {disabled
            ? "Event ditutup"
            : isFav
            ? "Favorit (+20)"
            : "Dukung (+5)"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isFav ? "Jadikan Favorit" : "Dukung"} {participantName}
          </DialogTitle>
          <DialogDescription>
            {isFav
              ? "Vote favorit memberi +20 poin. Terbatas 10 peserta per hari, 1x per peserta per hari."
              : "Vote harian memberi +5 poin. 1x per peserta per hari."}
          </DialogDescription>
        </DialogHeader>
        <VoterFormFields data={voter.data} onChange={voter.setData} />
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Kirim Dukungan (+{pts})
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
  const [files, setFiles] = React.useState<File[]>([]);
  const [links, setLinks] = React.useState<string[]>([""]);
  const [contentId, setContentId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const qc = useQueryClient();
  const confirm = useConfirm();
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

  function submit() {
    const err = validateVoter(voter.data);
    if (err) {
      toast.error(err);
      return;
    }
    if (needsContent && !contentId) {
      toast.error("Pilih konten peserta dulu.");
      return;
    }
    confirm({
      title: "Pastikan data kamu benar",
      description: `Nama: ${voter.data.name}\nNomor WhatsApp: ${voter.data.phone_number}\nEmail: ${voter.data.email}\n\nData ini dipakai panitia untuk menghubungimu jika kamu mendapatkan reward. Pastikan benar — tidak bisa diubah setelah dikirim.`,
      confirmText: "Saya Yakin, Kirim",
      onConfirm: doSubmit,
    });
  }

  async function doSubmit() {
    setBusy(true);
    try {
      let proofUrls: string[] = [];
      if (isLink) {
        const clean = links.map((l) => l.trim()).filter(Boolean);
        if (clean.length === 0 || clean.some((l) => !/^https?:\/\/.+/i.test(l))) {
          toast.error("Masukkan link postingan yang valid (mulai http).");
          return;
        }
        proofUrls = clean;
      } else {
        if (files.length === 0) {
          toast.error("Pilih minimal 1 file bukti.");
          return;
        }
        const supabase = createClient();
        for (const f of files) {
          // Proof cuma untuk verifikasi admin — kompres kecil (tekan egress).
          const upFile = await compressImage(f, { maxSize: 900, quality: 0.7 });
          const ext = upFile.name.split(".").pop();
          const path = `${Date.now()}-${Math.round(
            Math.random() * 1e6
          )}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("quest-proofs")
            .upload(path, upFile, { upsert: false, cacheControl: "31536000" });
          if (upErr) {
            toast.error("Gagal mengunggah: " + upErr.message);
            return;
          }
          proofUrls.push(
            supabase.storage.from("quest-proofs").getPublicUrl(path).data
              .publicUrl
          );
        }
      }

      if (proofUrls.length > 5) {
        toast.error("Maksimal 5 bukti.");
        return;
      }

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...voter.data,
          participant_id: participantId,
          quest_id: quest.id,
          proof_urls: proofUrls,
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
      setFiles([]);
      setLinks([""]);
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
          <a href={quest.ref_image} target="_blank" rel="noopener noreferrer">
            <Image
              src={quest.ref_image}
              alt="Referensi"
              width={400}
              height={160}
              sizes="400px"
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
                <Label>Link Postingan (boleh lebih dari 1, maks 5)</Label>
                {links.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://www.instagram.com/p/..."
                      value={l}
                      onChange={(e) =>
                        setLinks((arr) =>
                          arr.map((x, j) => (j === i ? e.target.value : x))
                        )
                      }
                    />
                    {links.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-destructive"
                        onClick={() =>
                          setLinks((arr) => arr.filter((_, j) => j !== i))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {links.length < 5 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setLinks((arr) => [...arr, ""])}
                  >
                    <Plus className="h-4 w-4" /> Tambah link
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>File Bukti (boleh lebih dari 1, maks 5)</Label>
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  disabled={files.length >= 5}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setFiles((prev) => {
                      const merged = [...prev];
                      for (const f of picked) {
                        if (
                          merged.length < 5 &&
                          !merged.some(
                            (x) => x.name === f.name && x.size === f.size
                          )
                        )
                          merged.push(f);
                      }
                      return merged;
                    });
                    e.target.value = ""; // reset agar bisa pilih lagi / file sama
                  }}
                />
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs"
                      >
                        <span className="min-w-0 truncate">{f.name}</span>
                        <button
                          type="button"
                          className="shrink-0 text-destructive"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, j) => j !== i))
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                    <li className="text-xs text-muted-foreground">
                      {files.length}/5 file
                    </li>
                  </ul>
                )}
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
