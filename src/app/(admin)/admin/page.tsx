"use client";

import {
  GraduationCap,
  School,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DailyVotesChart,
  TopParticipantsChart,
  VoterGrowthChart,
} from "@/components/charts";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import {
  useAdminStats,
  useDailyVoteSeries,
  useLeaderboard,
  useVoterGrowth,
} from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { EventToggle } from "@/components/event-toggle";

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading, isError, refetch } = useAdminStats();
  const { data: votes } = useDailyVoteSeries(14);
  const { data: growth } = useVoterGrowth(14);
  const { data: top } = useLeaderboard(8);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard Admin</h1>

      <EventToggle />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={School}
            label="Total Sekolah"
            value={formatNumber(stats?.total_schools)}
          />
          <StatCard
            icon={GraduationCap}
            label="Total Peserta"
            value={formatNumber(stats?.total_participants)}
          />
          <StatCard
            icon={Users}
            label="Total Voter"
            value={formatNumber(stats?.total_voters)}
          />
          <StatCard
            icon={ThumbsUp}
            label="Total Vote"
            value={formatNumber(stats?.total_votes)}
          />
          <StatCard
            icon={Trophy}
            label="Total Poin"
            value={formatNumber(stats?.total_points)}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vote Harian (14 hari)</CardTitle>
          </CardHeader>
          <CardContent>
            {votes && votes.length > 0 ? (
              <DailyVotesChart data={votes} />
            ) : (
              <EmptyState title="Belum ada data vote" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-primary" />
              Pertumbuhan Voter
            </CardTitle>
          </CardHeader>
          <CardContent>
            {growth && growth.length > 0 ? (
              <VoterGrowthChart data={growth} />
            ) : (
              <EmptyState title="Belum ada data voter" />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Peserta Teratas</CardTitle>
          </CardHeader>
          <CardContent>
            {top && top.length > 0 ? (
              <TopParticipantsChart
                data={top.map((p) => ({
                  name: p.name,
                  total_points: p.total_points,
                }))}
              />
            ) : (
              <EmptyState title="Belum ada peserta" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
