"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  fetchAllAdminVoters,
  useAdminVoters,
  useAdminVotersCount,
  useParticipants,
  useSchools,
  useVoterDistribution,
  type AdminVoter,
} from "@/lib/queries";
import { formatNumber, voterStatusLabel } from "@/lib/utils";
import { dateStamp, exportToExcel } from "@/lib/export-excel";

const PAGE_SIZE = 25;
const selectCls =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const STATUS_OPTS = [
  { value: "teman_sekolah", label: "Teman satu sekolah" },
  { value: "guru", label: "Guru" },
  { value: "keluarga", label: "Keluarga" },
  { value: "teman_luar", label: "Teman di luar sekolah" },
];

export default function AdminVotersPage() {
  const [participantId, setParticipantId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [schoolFilter, setSchoolFilter] = React.useState("");
  const [sort, setSort] = React.useState<
    "recent" | "points_desc" | "points_asc"
  >("recent");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<AdminVoter | null>(null);

  // Debounce search to avoid a query per keystroke.
  const [debSearch, setDebSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(
    () => setPage(1),
    [debSearch, statusFilter, schoolFilter, participantId, from, to, sort]
  );

  const baseFilters = {
    participantId,
    from,
    to,
    search: debSearch,
    status: statusFilter,
    school: schoolFilter,
  };

  const { data: total } = useAdminVotersCount(baseFilters);
  const { data, isLoading, isError, refetch } = useAdminVoters({
    ...baseFilters,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const { data: participants } = useParticipants();
  const { data: schoolList } = useSchools();

  const schools = (schoolList ?? []).map((s) => s.name);
  const totalCount = total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = data ?? [];

  const [exporting, setExporting] = React.useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const all = await fetchAllAdminVoters({ ...baseFilters, sort });
      if (all.length === 0) {
        toast.error("Tidak ada data untuk diekspor pada filter ini.");
        return;
      }
      const rows = all.map((v) => ({
        Nama: v.voter_name,
        "Nomor WA": v.voter_phone,
        Email: v.voter_email ?? "",
        Status: voterStatusLabel(v.voter_status) || "",
        Kelas: v.voter_class ?? "",
        Sekolah: v.voter_school ?? "",
        Bergabung: v.first_seen
          ? new Date(v.first_seen).toLocaleDateString("id-ID")
          : "",
        Vote: v.votes,
        Quest: v.quests,
        Poin: v.points,
      }));
      exportToExcel(rows, {
        fileName: `voter-${dateStamp()}.xlsx`,
        sheetName: "Voter",
      });
      toast.success(`${formatNumber(rows.length)} voter diekspor.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Gagal mengekspor data."
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daftar Voter</h1>
          <p className="text-sm text-muted-foreground">
            Total {formatNumber(totalCount)} voter. Klik baris untuk lihat
            distribusi poin.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={exporting || totalCount === 0}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export Excel
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Cari nama, nomor, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Peserta</span>
          <select
            className={`${selectCls} w-full sm:w-52`}
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
          >
            <option value="">Semua peserta</option>
            {(participants ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <select
            className={`${selectCls} w-full sm:w-44`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Semua status</option>
            {STATUS_OPTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Sekolah</span>
          <select
            className={`${selectCls} w-full sm:w-44`}
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
          >
            <option value="">Semua sekolah</option>
            {schools.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Urutkan</span>
          <select
            className={`${selectCls} w-full sm:w-48`}
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as typeof sort)
            }
          >
            <option value="recent">Terbaru bergabung</option>
            <option value="points_desc">Poin tertinggi</option>
            <option value="points_asc">Poin terendah</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Dari</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Sampai</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        {(participantId || from || to || statusFilter || schoolFilter || search) && (
          <button
            className="h-9 rounded-md border px-3 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => {
              setParticipantId("");
              setFrom("");
              setTo("");
              setStatusFilter("");
              setSchoolFilter("");
              setSearch("");
            }}
          >
            Reset
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : paged.length === 0 ? (
        <EmptyState title="Belum ada voter" />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voter</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sekolah</TableHead>
                    <TableHead>Bergabung</TableHead>
                    <TableHead className="text-right">Vote</TableHead>
                    <TableHead className="text-right">Quest</TableHead>
                    <TableHead className="text-right">Poin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((v) => (
                    <TableRow
                      key={v.voter_phone}
                      className="cursor-pointer"
                      onClick={() => setSelected(v)}
                    >
                      <TableCell>
                        <p className="font-medium">{v.voter_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.voter_phone}
                          {v.voter_email ? ` · ${v.voter_email}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {voterStatusLabel(v.voter_status) || "—"}
                        {v.voter_class ? ` (${v.voter_class})` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {v.voter_school ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.first_seen
                          ? new Date(v.first_seen).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(v.votes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(v.quests)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatNumber(v.points)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              >
                Sebelumnya
              </button>
              <span className="text-sm text-muted-foreground">
                Hal {current} / {pageCount}
              </span>
              <button
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                disabled={current >= pageCount}
                onClick={() => setPage(current + 1)}
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}

      <DistributionDialog
        voter={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function DistributionDialog({
  voter,
  onClose,
}: {
  voter: AdminVoter | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useVoterDistribution(voter?.voter_phone);

  return (
    <Dialog open={!!voter} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{voter?.voter_name}</DialogTitle>
          <DialogDescription>
            {voter?.voter_phone}
            {voter?.voter_email ? ` · ${voter.voter_email}` : ""} · Total{" "}
            {formatNumber(voter?.points ?? 0)} poin
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingState />
        ) : !data || data.length === 0 ? (
          <EmptyState title="Belum ada distribusi poin" />
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Poin diberikan ke:</p>
            <ul className="space-y-1.5">
              {data.map((d) => (
                <li
                  key={d.participant_id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.participant_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.school_name ?? "—"} · {formatNumber(d.votes)} vote ·{" "}
                      {formatNumber(d.quests)} quest
                    </p>
                  </div>
                  <Badge variant="accent" className="shrink-0">
                    {formatNumber(d.points)} poin
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
