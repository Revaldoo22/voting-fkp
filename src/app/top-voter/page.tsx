"use client";

import { Gift, Crown, Medal, Trophy } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTopVoters } from "@/lib/queries";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/states";
import { formatNumber, cn } from "@/lib/utils";

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Trophy className="h-5 w-5 text-orange-500" />;
  return <span className="w-5 text-center font-semibold">{rank}</span>;
}

export default function TopVoterPage() {
  const { data, isLoading, isError, refetch } = useTopVoters(200);

  return (
    <div className="min-h-screen">
      <Navbar
        title="🔥 Top Voter Teraktif"
        links={[
          { href: "/", label: "Beranda" },
          { href: "/ranking", label: "Ranking" },
          { href: "/login", label: "Masuk" },
        ]}
      />
      <main className="container max-w-2xl py-8">
        <Card className="mb-6 border-accent/40 bg-accent/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Gift className="h-8 w-8 text-accent" />
            <div className="text-sm">
              <p className="font-semibold">Hadiah Top 5 Voter</p>
              <p className="text-muted-foreground">
                Tumbler eksklusif + sertifikat penghargaan.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="mb-4 text-sm text-muted-foreground">
          Peringkat berdasarkan jumlah vote, quest selesai, dan aktivitas valid.
        </p>

        {isLoading ? (
          <CardSkeletonGrid count={3} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="Belum ada voter aktif"
            description="Top voter akan muncul setelah ada aktivitas dukungan."
          />
        ) : (
          <ol className="space-y-2">
            {data.map((v, i) => {
              const rank = i + 1;
              return (
                <li
                  key={`${v.voter_name}-${i}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm",
                    rank === 1 && "border-amber-400 bg-amber-50/40"
                  )}
                >
                  <div className="flex w-8 justify-center">
                    <RankIcon rank={rank} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.voter_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.school_name ?? "—"} · {formatNumber(v.votes)} vote ·{" "}
                      {formatNumber(v.quests)} quest
                    </p>
                  </div>
                  <Badge variant="accent">{formatNumber(v.score)} poin</Badge>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
