"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/states";
import { useParticipants } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/utils";

export function ParticipantGrid() {
  const { data, isLoading, isError, refetch } = useParticipants();
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");

  // Realtime: refresh on point changes.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("home-participants")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => qc.invalidateQueries({ queryKey: ["participants"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  if (isLoading) return <CardSkeletonGrid />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const active = (data ?? []).filter((p) => p.status === "active");
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
          {list.map((p) => (
            <Link key={p.id} href={`/peserta/${p.id}`} className="group">
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="relative aspect-square w-full overflow-hidden bg-muted">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
    </div>
  );
}
