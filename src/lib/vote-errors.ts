/** Maps cast_daily_vote() raised codes to user-facing Indonesian messages. */
export function voteErrorMessage(raw: string | undefined | null): string {
  const code = (raw ?? "").toUpperCase();
  if (code.includes("DEVICEVOTED") || code.includes("DEVICEMISMATCH")) {
    return "Perangkat ini sudah digunakan untuk memberikan dukungan hari ini.";
  }
  if (code.includes("ALREADYVOTED")) {
    return "Kamu sudah memberikan dukungan hari ini. Kembali lagi besok!";
  }
  if (code.includes("WRONGSCHOOL")) {
    return "Kamu hanya dapat mendukung peserta dari sekolah yang kamu pilih saat daftar.";
  }
  if (code.includes("NOTLOGGEDIN")) {
    return "Sesi tidak valid. Silakan login kembali.";
  }
  if (code.includes("NOFINGERPRINT")) {
    return "Gagal mengenali perangkat. Muat ulang halaman dan coba lagi.";
  }
  if (code.includes("NOTFOUND")) {
    return "Peserta tidak ditemukan atau tidak aktif.";
  }
  if (code.includes("EVENTCLOSED")) {
    return "Event sedang ditutup. Dukungan belum/tidak bisa diberikan saat ini.";
  }
  if (code.includes("IPLIMIT")) {
    return "Terlalu banyak akun memberikan dukungan dari jaringan ini hari ini. Coba lagi besok atau gunakan jaringan lain.";
  }
  return "Gagal memberikan dukungan. Silakan coba lagi.";
}
