"use client";

import * as React from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useLeaderboard } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { formatNumber, cn } from "@/lib/utils";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/states";

const rankStyles = [
  "bg-gradient-to-r from-amber-400/20 to-amber-100/10 border-amber-400",
  "bg-gradient-to-r from-slate-300/20 to-slate-100/10 border-slate-400",
  "bg-gradient-to-r from-orange-400/20 to-orange-100/10 border-orange-400",
];

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Trophy className="h-5 w-5 text-orange-500" />;
  return <span className="w-5 text-center text-sm font-semibold">{rank}</span>;
}

export function Leaderboard({ limit = 50 }: { limit?: number }) {
  const { data, isLoading, isError, refetch } = useLeaderboard(limit);
  const qc = useQueryClient();

  // Realtime: refresh whenever participant points change.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("leaderboard-participants")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants" },
        () => {
          qc.invalidateQueries({ queryKey: ["leaderboard"] });
          qc.invalidateQueries({ queryKey: ["participants"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  if (isLoading) return <CardSkeletonGrid count={3} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!data || data.length === 0)
    return (
      <EmptyState
        title="Belum ada peserta"
        description="Leaderboard akan tampil saat peserta sudah ditambahkan."
      />
    );

  return (
    <ol className="space-y-2">
      {data.map((p, i) => {
        const rank = i + 1;
        return (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors",
              rank <= 3 && rankStyles[rank - 1]
            )}
          >
            <div className="flex w-8 shrink-0 items-center justify-center">
              <RankIcon rank={rank} />
            </div>
            <Avatar className="h-11 w-11 border">
              {p.photo_url && <AvatarImage src={p.photo_url} alt={p.name} />}
              <AvatarFallback>{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.schools?.name ?? "—"}
              </p>
            </div>
            <Badge variant={rank <= 3 ? "accent" : "secondary"} className="shrink-0">
              {formatNumber(p.total_points)} poin
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
