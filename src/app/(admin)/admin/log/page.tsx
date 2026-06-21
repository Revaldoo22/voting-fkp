"use client";

import * as React from "react";
import { Heart, Star, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  useActivityLog,
  useActivityLogCount,
  useParticipants,
} from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

const PAGE_SIZE = 30;
const selectCls =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const KIND_OPTS = [
  { value: "all", label: "Semua jenis" },
  { value: "daily5", label: "Vote Harian (+5)" },
  { value: "fav20", label: "Vote Favorit (+20)" },
  { value: "quest", label: "Quest" },
];
const QSTATUS_OPTS = [
  { value: "", label: "Semua status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
];

function kindBadge(kind: string) {
  if (kind === "fav20")
    return (
      <Badge variant="accent" className="gap-1">
        <Star className="h-3 w-3" /> Favorit
      </Badge>
    );
  if (kind === "quest")
    return (
      <Badge variant="secondary" className="gap-1">
        <Trophy className="h-3 w-3" /> Quest
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1">
      <Heart className="h-3 w-3" /> Harian
    </Badge>
  );
}

const fmt = (s: string) =>
  new Date(s).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminLogPage() {
  const [kind, setKind] = React.useState("all");
  const [participantId, setParticipantId] = React.useState("");
  const [qstatus, setQstatus] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [debSearch, setDebSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(
    () => setPage(1),
    [kind, participantId, qstatus, from, to, debSearch]
  );

  const base = {
    kind,
    participantId,
    qstatus: kind === "quest" || kind === "all" ? qstatus : "",
    from,
    to,
    search: debSearch,
  };

  const { data: total } = useActivityLogCount(base);
  const { data, isLoading, isError, refetch } = useActivityLog({
    ...base,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const { data: participants } = useParticipants();

  const totalCount = total ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = data ?? [];

  const showQstatus = kind === "quest" || kind === "all";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Log Aktivitas</h1>
        <p className="text-sm text-muted-foreground">
          {formatNumber(totalCount)} aktivitas (vote, favorit, quest).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Cari voter (nama/nomor)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs"
        />
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Jenis</span>
          <select
            className={`${selectCls} w-full sm:w-48`}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {KIND_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
        {showQstatus && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Status quest</span>
            <select
              className={`${selectCls} w-full sm:w-40`}
              value={qstatus}
              onChange={(e) => setQstatus(e.target.value)}
            >
              {QSTATUS_OPTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
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
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Tidak ada aktivitas pada filter ini" />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Voter</TableHead>
                    <TableHead>Peserta</TableHead>
                    <TableHead className="text-right">Poin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {kindBadge(r.kind)}
                          {r.kind === "quest" && (
                            <span className="text-xs text-muted-foreground">
                              {r.source}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{r.voter_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.voter_phone}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.participant_name}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        +{r.points}
                      </TableCell>
                      <TableCell>
                        {r.kind === "quest" ? (
                          <Badge
                            variant={
                              r.status === "approved"
                                ? "success"
                                : r.status === "rejected"
                                ? "destructive"
                                : "warning"
                            }
                          >
                            {r.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmt(r.created_at)}
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
    </div>
  );
}
