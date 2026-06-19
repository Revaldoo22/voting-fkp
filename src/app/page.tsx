import Link from "next/link";
import {
  Award,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  Star,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { Leaderboard } from "@/components/leaderboard";

const prizes = [
  {
    icon: Smartphone,
    title: "Smartphone",
    desc: "Untuk peserta dengan dukungan terbanyak.",
  },
  {
    icon: Award,
    title: "Sertifikat",
    desc: "Penghargaan resmi Universitas STEKOM.",
  },
  {
    icon: Star,
    title: "Duta Teladan STEKOM",
    desc: "Benefit khusus sebagai Duta Teladan Universitas STEKOM.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar
        links={[
          { href: "/ranking", label: "Ranking" },
          { href: "/top-voter", label: "Top Voter" },
          { href: "/login", label: "Mulai Vote Sekarang", cta: true },
        ]}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container grid items-center gap-8 py-16 md:grid-cols-2 md:py-24">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
              <GraduationCap className="h-4 w-4 text-primary" />
              Universitas STEKOM
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              Festival Karakter{" "}
              <span className="text-primary">Pelajar</span>
            </h1>
            <p className="max-w-prose text-lg text-muted-foreground">
              Kompetisi karakter pelajar SMA/SMK se-wilayah. Setiap peserta
              membawa nama sekolahnya dan berlomba mengumpulkan dukungan
              terbanyak. Dukung jagoanmu sekarang!
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/login">Mulai Mendukung</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/ranking">Lihat Ranking</Link>
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Sistem anti-cheat: 1 perangkat &amp; 1 akun, 1 dukungan per hari.
            </p>
          </div>

          <Card className="border-2">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <Trophy className="h-5 w-5 text-accent" />
                Peringkat Teratas
              </div>
              <Leaderboard limit={5} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Prizes */}
      <section className="container py-16">
        <h2 className="mb-2 text-center text-2xl font-bold">Hadiah Pemenang</h2>
        <p className="mb-10 text-center text-muted-foreground">
          Penghargaan eksklusif menanti peserta terbaik.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {prizes.map((p) => (
            <Card key={p.title} className="text-center">
              <CardContent className="space-y-3 p-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <p.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Festival Karakter Pelajar — Universitas
        STEKOM.
      </footer>
    </div>
  );
}
