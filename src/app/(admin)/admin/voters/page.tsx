"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
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
  useAdminVoters,
  useParticipants,
  useVoterDistribution,
  type AdminVoter,
} from "@/lib/queries";
import { formatNumber, voterStatusLabel } from "@/lib/utils";

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
  // Server-side filters: participant + date range.
  const [participantId, setParticipantId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  // Client-side filters: search + status + school.
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [schoolFilter, setSchoolFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<AdminVoter | null>(null);

  const { data, isLoading, isError, refetch } = useAdminVoters({
    participantId,
    from,
    to,
  });
  const { data: participants } = useParticipants();

  React.useEffect(
    () => setPage(1),
    [search, statusFilter, schoolFilter, participantId, from, to]
  );

  // Distinct schools present in the result for the school dropdown.
  const schools = React.useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((v) => v.voter_school && set.add(v.voter_school));
    return Array.from(set).sort();
  }, [data]);

  const q = search.trim().toLowerCase();
  const list = React.useMemo(() => {
    return (data ?? []).filter((v) => {
      if (statusFilter && v.voter_status !== statusFilter) return false;
      if (schoolFilter && v.voter_school !== schoolFilter) return false;
      if (
        q &&
        !(
          v.voter_name?.toLowerCase().includes(q) ||
          v.voter_phone?.includes(q) ||
          v.voter_email?.toLowerCase().includes(q) ||
          v.voter_school?.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [data, q, statusFilter, schoolFilter]);

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daftar Voter</h1>
        <p className="text-sm text-muted-foreground">
          Total {formatNumber(data?.length ?? 0)} voter. Klik baris untuk lihat
          distribusi poin.
        </p>
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

          {list.length > PAGE_SIZE && (
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
