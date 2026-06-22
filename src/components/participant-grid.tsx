"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/states";
import { useParticipants } from "@/lib/queries";
import { formatNumber } from "@/lib/utils";

const PAGE_SIZE = 20;

export function ParticipantGrid() {
  const { data, isLoading, isError, refetch } = useParticipants();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setPage(1), [search]);

  if (isLoading) return <CardSkeletonGrid />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const active = (data ?? [])
    .filter((p) => p.status === "active")
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  const q = search.trim().toLowerCase();
  const list = q
    ? active.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.schools?.name?.toLowerCase().includes(q)
      )
    : active;

  if (active.length === 0)
    return (
      <EmptyState
        title="Belum ada peserta"
        description="Peserta akan tampil setelah ditambahkan panitia."
      />
    );

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Cari peserta atau sekolah..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      {list.length === 0 ? (
        <EmptyState title="Tidak ada peserta cocok pencarian" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {paged.map((p) => (
            <Link key={p.id} href={`/peserta/${p.id}`} className="group">
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="relative aspect-square w-full overflow-hidden bg-muted">
                  {p.photo_url ? (
                    <Image
                      src={p.photo_url}
                      alt={p.name}
                      fill
                      sizes="(max-width:768px) 50vw, (max-width:1280px) 25vw, 20vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Avatar className="h-14 w-14">
                        <AvatarFallback>
                          {p.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <Badge
                    variant="accent"
                    className="absolute right-1.5 top-1.5 shadow"
                  >
                    {formatNumber(p.total_points)}
                  </Badge>
                </div>
                <CardContent className="p-3">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.schools?.name ?? "—"}
                  </p>
                  <div className="mt-1.5 flex items-center justify-end text-xs font-medium text-primary">
                    Dukung
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {list.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Hal {current} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={current >= pageCount}
            onClick={() => setPage(current + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}
