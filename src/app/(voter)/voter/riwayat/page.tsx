"use client";

import { ArrowLeft, Heart, Trophy } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useMyActivity } from "@/lib/queries";

const statusBadge = (s: string) =>
  s === "approved"
    ? { variant: "success" as const, label: "Disetujui" }
    : s === "rejected"
    ? { variant: "destructive" as const, label: "Ditolak" }
    : { variant: "warning" as const, label: "Menunggu" };

export default function VoterHistoryPage() {
  const { data, isLoading, isError, refetch } = useMyActivity();

  return (
    <div className="min-h-screen">
      <Navbar title="Riwayat Aktivitas" links={[{ href: "/ranking", label: "Ranking" }]} showLogout />
      <main className="container max-w-3xl space-y-4 py-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/voter/dashboard">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Link>
        </Button>

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas"
            description="Vote atau kerjakan quest untuk mulai mengisi riwayat."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aktivitas</TableHead>
                    <TableHead>Peserta</TableHead>
                    <TableHead className="text-right">Poin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a, i) => {
                    const sb = statusBadge(a.status);
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium">
                            {a.kind === "vote" ? (
                              <Heart className="h-4 w-4 text-primary" />
                            ) : (
                              <Trophy className="h-4 w-4 text-accent" />
                            )}
                            {a.label}
                          </span>
                          {a.status === "rejected" && a.note && (
                            <span className="mt-0.5 block text-xs text-destructive">
                              Alasan: {a.note}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.participant_name}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          +{a.points}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sb.variant}>{sb.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(a.date).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
