import Link from "next/link";
import { Award, GraduationCap, Smartphone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { ParticipantGrid } from "@/components/participant-grid";

const prizes = [
  { icon: Smartphone, title: "Smartphone", desc: "Untuk peserta dengan dukungan terbanyak." },
  { icon: Award, title: "Sertifikat", desc: "Penghargaan resmi Universitas STEKOM." },
  { icon: Star, title: "Duta Teladan STEKOM", desc: "Benefit khusus sebagai Duta Teladan Universitas STEKOM." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar
        links={[
          { href: "/ranking", label: "Ranking" },
          { href: "/top-voter", label: "Top Voter" },
        ]}
      />

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container space-y-5 py-12 text-center md:py-16">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
            <GraduationCap className="h-4 w-4 text-primary" />
            Universitas STEKOM
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Festival Karakter <span className="text-primary">Pelajar</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Dukung pelajar favoritmu! Pilih peserta di bawah, beri dukungan, dan
            bantu mereka memenangkan hadiah.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <a href="#peserta">Lihat Peserta</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/ranking">Lihat Ranking</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Prizes */}
      <section className="container py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {prizes.map((p) => (
            <Card key={p.title} className="text-center">
              <CardContent className="space-y-2 p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <p.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* All participants */}
      <section id="peserta" className="container scroll-mt-20 py-8">
        <h2 className="mb-1 text-2xl font-bold">Daftar Peserta</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Klik peserta untuk memberi dukungan &amp; mengerjakan quest.
        </p>
        <ParticipantGrid />
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Festival Karakter Pelajar — Universitas
        STEKOM.
      </footer>
    </div>
  );
}
