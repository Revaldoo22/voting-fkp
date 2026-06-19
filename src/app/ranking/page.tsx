import { Navbar } from "@/components/navbar";
import { Leaderboard } from "@/components/leaderboard";

export default function RankingPage() {
  return (
    <div className="min-h-screen">
      <Navbar
        title="🏆 Leaderboard Peserta"
        links={[
          { href: "/", label: "Beranda" },
          { href: "/top-voter", label: "Top Voter" },
          { href: "/login", label: "Masuk" },
        ]}
      />
      <main className="container max-w-2xl py-8">
        <p className="mb-6 text-sm text-muted-foreground">
          Peringkat diperbarui secara realtime mengikuti dukungan yang masuk.
        </p>
        <Leaderboard limit={100} />
      </main>
    </div>
  );
}
