"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <Link key={p.id} href={`/peserta/${p.id}`} className="group">
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  {p.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photo_url}
                      alt={p.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Avatar className="h-20 w-20">
                        <AvatarFallback className="text-xl">
                          {p.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate">{p.name}</span>
                    <Badge variant="accent" className="shrink-0">
                      {formatNumber(p.total_points)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.schools?.name ?? "—"}
                  </p>
                  <div className="mt-2 flex items-center justify-end text-sm font-medium text-primary">
                    Dukung
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
