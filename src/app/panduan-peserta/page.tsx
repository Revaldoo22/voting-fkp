import type { Metadata } from "next";
import Link from "next/link";
import {
  Award,
  Camera,
  KeyRound,
  Link as LinkIcon,
  ListChecks,
  LogIn,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { ContactAdminButton } from "@/components/contact-admin";
import { PasswordLookup } from "./password-lookup";

export const metadata: Metadata = {
  title: "Panduan Peserta — Festival Karakter Pelajar STEKOM",
  description:
    "Panduan penggunaan dashboard peserta: poin, peringkat, supporter, konten, dan pengaturan akun.",
};

type Step = {
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
};

const steps: Step[] = [
  {
    icon: LogIn,
    title: "1. Masuk ke Akun",
    body: (
      <>
        Buka <strong>/login/peserta</strong>, lalu masuk pakai{" "}
        <strong>nama lengkap atau nomor WhatsApp</strong> + password yang
        diberikan panitia. Password ada di lembar data (lihat tombol di bawah).
      </>
    ),
  },
  {
    icon: Award,
    title: "2. Kartu Profil & Peringkat",
    body: (
      <>
        Di bagian atas dashboard ada foto, nama, sekolah, <strong>peringkat</strong>,
        dan status kamu. Peringkat dihitung otomatis dari total poin.
      </>
    ),
  },
  {
    icon: Camera,
    title: "3. Ganti Foto",
    body: (
      <>
        Klik tombol <strong>Ganti Foto</strong> di kartu profil untuk
        memperbarui fotomu. Foto otomatis dikompres agar ringan.
      </>
    ),
  },
  {
    icon: Trophy,
    title: "4. Total Poin, Peringkat, Pendukung",
    body: (
      <>
        Tiga kartu ringkasan: <strong>Total Poin</strong> (dari vote + quest),{" "}
        <strong>Peringkat</strong>, dan <strong>Total Pendukung</strong> (jumlah
        orang yang mendukungmu).
      </>
    ),
  },
  {
    icon: TrendingUp,
    title: "5. Perkembangan Poin",
    body: (
      <>
        Grafik menunjukkan pertumbuhan poinmu dari hari ke hari, gabungan dari
        vote harian, vote favorit, dan quest yang disetujui.
      </>
    ),
  },
  {
    icon: Users,
    title: "6. Supporter Terbesar",
    body: (
      <>
        Daftar pendukung dengan kontribusi poin terbanyak. Tampil 5 teratas;
        klik <strong>Tampilkan semua</strong> untuk melihat seluruh pendukung.
      </>
    ),
  },
  {
    icon: LinkIcon,
    title: "7. Link Konten Aku",
    body: (
      <>
        Tambahkan link kontenmu (TikTok/IG). Pendukung memilih konten ini saat
        mengerjakan quest <strong>Like/Komen/Repost</strong> atau{" "}
        <strong>Pakai Sound</strong>. Pilih jenis, tempel link, klik Tambah
        Link. Makin banyak konten, makin banyak poin yang bisa masuk.
      </>
    ),
  },
  {
    icon: KeyRound,
    title: "8. Pengaturan Akun",
    body: (
      <>
        Ubah <strong>deskripsi diri</strong> dan <strong>ganti password</strong>{" "}
        di bagian Pengaturan Akun. Gunakan password yang mudah kamu ingat.
      </>
    ),
  },
];

export default function PanduanPesertaPage() {
  return (
    <div className="min-h-screen">
      <Navbar links={[{ href: "/", label: "Beranda" }]} />

      <main className="container max-w-3xl space-y-8 py-10">
        <header className="space-y-2 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium">
            <ListChecks className="h-4 w-4 text-primary" />
            Panduan Peserta
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Cara Pakai Dashboard Peserta
          </h1>
          <p className="text-muted-foreground">
            Kenali fitur di halaman dashboard kamu, dari poin sampai kelola
            konten.
          </p>
        </header>

        <ol className="space-y-6">
          {steps.map((s) => (
            <li key={s.title}>
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <h2 className="text-lg font-semibold">{s.title}</h2>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>

        {/* CTA */}
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="space-y-4 p-6 text-center">
            <h2 className="text-xl font-bold">Cari Password Kamu</h2>
            <p className="text-sm text-muted-foreground">
              Ketik namamu untuk melihat password akun, lalu masuk ke dashboard.
            </p>
            <PasswordLookup />
            <p className="text-xs text-muted-foreground">
              Tidak ketemu atau lupa password? Hubungi panitia.
            </p>
            <div className="flex flex-col justify-center gap-3 border-t pt-4 sm:flex-row">
              <ContactAdminButton
                size="default"
                label="Minta Password ke Admin"
                message="Halo Admin Festival Karakter Pelajar, saya peserta dan ingin meminta/menanyakan password akun saya. Nama saya: "
              />
              <Button asChild>
                <Link href="/login/peserta">
                  <LogIn className="h-4 w-4" /> Login Peserta
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Festival Karakter Pelajar — Universitas
        STEKOM.
      </footer>
    </div>
  );
}
