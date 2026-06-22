import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/navbar";
import { ParticipantGrid } from "@/components/participant-grid";
import { PrizeButtons } from "@/components/prize-buttons";
import { MaintenanceOverlay } from "@/components/maintenance-overlay";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <MaintenanceOverlay />
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
              <Link href="/ranking">Peringkat Sementara</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/top-voter">Top Voter</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Prizes */}
      <section className="container py-12">
        <PrizeButtons />
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
