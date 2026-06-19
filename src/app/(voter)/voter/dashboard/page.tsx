"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CardSkeletonGrid,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/states";
import { History, Trophy, Flame } from "lucide-react";
import {
  useMyContributions,
  useMyProfile,
  useMyVoteToday,
  useParticipants,
  useSettings,
} from "@/lib/queries";
import { formatNumber } from "@/lib/utils";
import { ContactAdminButton } from "@/components/contact-admin";

export default function VoterDashboard() {
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const {
    data: participants,
    isLoading,
    isError,
    refetch,
  } = useParticipants(profile?.school_id);
  const { data: voteToday } = useMyVoteToday();
  const { data: contrib } = useMyContributions();
  const { data: settings } = useSettings();

  const alreadyVoted = voteToday?.voted ?? false;
  const eventClosed = settings ? !settings.event_open : false;

  return (
    <div className="min-h-screen">
      <Navbar
        title="Dukung Peserta Pilihanmu"
        links={[
          { href: "/voter/riwayat", label: "Riwayat", icon: History },
          { href: "/ranking", label: "Ranking", icon: Trophy },
          { href: "/top-voter", label: "Top Voter", icon: Flame },
        ]}
        showLogout
      />
      <main className="container space-y-8 py-8">
        {eventClosed && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm font-medium text-destructive">
            {settings?.closed_message ?? "Event sedang ditutup."}
          </div>
        )}
        {profileLoading ? (
          <LoadingState />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
            <div>
              <p className="text-sm text-muted-foreground">Halo,</p>
              <p className="text-lg font-semibold">{profile?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {alreadyVoted ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Sudah mendukung hari ini
                </Badge>
              ) : (
                <Badge variant="warning">Belum mendukung hari ini</Badge>
              )}
              <ContactAdminButton />
            </div>
          </div>
        )}

        {/* Kontribusi poin */}
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">
                Total poin yang kamu berikan
              </p>
              <p className="text-3xl font-bold text-primary">
                {formatNumber(contrib?.total ?? 0)}
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/voter/riwayat">
                <History className="h-4 w-4" /> Riwayat Aktivitas
              </Link>
            </Button>
          </div>
          {contrib && contrib.perParticipant.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              {contrib.perParticipant.map((p) => (
                <Badge key={p.name} variant="secondary">
                  {p.name}: {formatNumber(p.points)} poin
                </Badge>
              ))}
            </div>
          )}
        </div>

        <section>
          <h2 className="mb-1 text-lg font-semibold">
            Peserta dari sekolah yang kamu dukung
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Klik peserta untuk mendukung &amp; mengerjakan quest mereka.
          </p>
          {isLoading ? (
            <CardSkeletonGrid />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !participants || participants.length === 0 ? (
            <EmptyState
              title="Belum ada peserta"
              description="Peserta dari sekolah yang kamu dukung belum ditambahkan oleh panitia."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {participants.map((p) => {
                const votedThis =
                  alreadyVoted && voteToday?.participant_id === p.id;
                return (
                  <Link
                    key={p.id}
                    href={`/voter/participant/${p.id}`}
                    className="group"
                  >
                    <Card className="overflow-hidden transition-shadow group-hover:shadow-md">
                      <div className="aspect-video w-full overflow-hidden bg-muted">
                        {p.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.photo_url}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Avatar className="h-16 w-16">
                              <AvatarFallback>
                                {p.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                      </div>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="truncate">{p.name}</span>
                          <Badge variant="secondary">
                            {formatNumber(p.total_points)} poin
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                          {p.description || "Tanpa deskripsi."}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-sm font-medium text-primary">
                          {votedThis ? (
                            <span className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" /> Sudah didukung
                            </span>
                          ) : (
                            <span>Lihat &amp; Dukung</span>
                          )}
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
