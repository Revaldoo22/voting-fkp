"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Link as LinkIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CardSkeletonGrid,
  EmptyState,
  ErrorState,
} from "@/components/states";
import {
  useReviewSubmission,
  useSubmissionCounts,
  useSubmissions,
} from "@/lib/queries";

const isImage = (url: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(url);
const PAGE_SIZE = 12;

export default function AdminSubmissionsPage() {
  const [tab, setTab] = React.useState<string>("pending");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [rejectTarget, setRejectTarget] = React.useState<string | null>(null);
  const [rejectNote, setRejectNote] = React.useState("");
  const { data, isLoading, isError, refetch } = useSubmissions(
    tab === "all" ? undefined : tab
  );
  const { data: counts } = useSubmissionCounts();
  const review = useReviewSubmission();

  React.useEffect(() => setPage(1), [tab, search]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (s) =>
        s.participants?.name.toLowerCase().includes(q) ||
        s.participants?.schools?.name?.toLowerCase().includes(q) ||
        s.voter_name?.toLowerCase().includes(q) ||
        s.voter_email?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function approve(id: string) {
    try {
      await review.mutateAsync({ id, status: "approved" });
      toast.success("Disetujui — poin ditambahkan.");
    } catch (e) {
      toast.error("Gagal memproses: " + (e as Error).message);
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    try {
      await review.mutateAsync({
        id: rejectTarget,
        status: "rejected",
        note: rejectNote.trim() || undefined,
      });
      toast.success("Submission ditolak.");
      setRejectTarget(null);
      setRejectNote("");
    } catch (e) {
      toast.error("Gagal memproses: " + (e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Verifikasi Submission Quest</h1>
        {counts && (
          <p className="text-sm text-muted-foreground">
            Sisa pending: <span className="font-semibold text-foreground">{counts.pending}</span>
            {" · "}disetujui {counts.approved} · ditolak {counts.rejected}
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending{counts ? ` (${counts.pending})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Disetujui{counts ? ` (${counts.approved})` : ""}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Ditolak{counts ? ` (${counts.rejected})` : ""}
          </TabsTrigger>
          <TabsTrigger value="all">
            Semua{counts ? ` (${counts.all})` : ""}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Input
        placeholder="Cari peserta, sekolah, atau voter..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <CardSkeletonGrid />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : paged.length === 0 ? (
        <EmptyState title="Tidak ada submission" />
      ) : (
        <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paged.map((s) => {
            const proofs =
              s.submission_proofs && s.submission_proofs.length > 0
                ? s.submission_proofs.map((p) => p.url)
                : [s.proof_url];
            const main = proofs[0];
            const isLinkQuest = s.quests?.proof_type === "link";
            return (
            <Card key={s.id} className="overflow-hidden">
              <div className="relative flex aspect-video w-full items-center justify-center bg-black/90">
                {isLinkQuest ? (
                  <div className="flex max-h-full flex-col gap-1 overflow-y-auto p-4 text-center text-sm text-white">
                    <LinkIcon className="mx-auto h-7 w-7" />
                    {proofs.map((u, i) => (
                      <a
                        key={i}
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all hover:underline"
                      >
                        {i + 1}. {u}
                      </a>
                    ))}
                  </div>
                ) : isImage(main) ? (
                  <Image
                    src={main}
                    alt="bukti"
                    fill
                    sizes="(max-width:1024px) 50vw, 33vw"
                    className="cursor-zoom-in object-contain"
                    onClick={() => setPreview(main)}
                  />
                ) : (
                  <video src={main} controls className="h-full w-full" />
                )}
              </div>
              {!isLinkQuest && proofs.length > 1 && (
                <div className="flex gap-1 overflow-x-auto border-b p-1">
                  {proofs.map((u, i) =>
                    isImage(u) ? (
                      <Image
                        key={i}
                        src={u}
                        alt={`bukti ${i + 1}`}
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 cursor-zoom-in rounded object-cover"
                        onClick={() => setPreview(u)}
                      />
                    ) : (
                      <a
                        key={i}
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted text-xs"
                      >
                        ▶
                      </a>
                    )
                  )}
                </div>
              )}
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      s.status === "approved"
                        ? "success"
                        : s.status === "rejected"
                        ? "destructive"
                        : "warning"
                    }
                  >
                    {s.status}
                  </Badge>
                  <Badge variant="accent">+{s.quests?.point ?? 0}</Badge>
                </div>
                <div className="text-sm">
                  <p className="font-medium">{s.quests?.name}</p>
                  <p className="text-muted-foreground">
                    Untuk: {s.participants?.name ?? "—"}
                    {s.participants?.schools?.name
                      ? ` · ${s.participants.schools.name}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Oleh: {s.voter_name ?? "—"}
                    {s.voter_email ? ` · ${s.voter_email}` : ""}
                  </p>
                  {(s.voter_phone || s.voter_school) && (
                    <p className="text-xs text-muted-foreground">
                      {s.voter_phone ?? ""}
                      {s.voter_school ? ` · ${s.voter_school}` : ""}
                      {s.voter_class ? ` (${s.voter_class})` : ""}
                    </p>
                  )}
                  {s.participant_contents?.url && (
                    <p className="mt-1 text-xs">
                      <span className="text-muted-foreground">Konten peserta: </span>
                      <a
                        href={s.participant_contents.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-primary hover:underline"
                      >
                        {s.participant_contents.url}
                      </a>
                    </p>
                  )}
                  {s.status === "rejected" && s.review_note && (
                    <p className="mt-1 text-xs text-destructive">
                      Alasan: {s.review_note}
                    </p>
                  )}
                </div>
                {s.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={review.isPending}
                      onClick={() => approve(s.id)}
                    >
                      {review.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={review.isPending}
                      onClick={() => {
                        setRejectTarget(s.id);
                        setRejectNote("");
                      }}
                    >
                      <X className="h-4 w-4" /> Tolak
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
        </div>

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
        </>
      )}

      {/* Reject with reason */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Submission</DialogTitle>
            <DialogDescription>
              Beri alasan penolakan (opsional). Alasan akan terlihat oleh voter
              di riwayatnya.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Mis. Screenshot tidak jelas / akun belum di-follow."
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
          />
          <Button
            variant="destructive"
            onClick={confirmReject}
            disabled={review.isPending}
          >
            {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tolak Submission
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Pratinjau bukti</DialogTitle>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Pratinjau bukti"
              className="max-h-[80dvh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
