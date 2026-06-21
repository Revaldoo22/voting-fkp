/** Maps cast_daily_vote() raised codes to user-facing Indonesian messages. */
export function voteErrorMessage(raw: string | undefined | null): string {
  const code = (raw ?? "").toUpperCase();
  if (code.includes("DEVICEVOTED") || code.includes("DEVICEMISMATCH")) {
    return "Perangkat ini sudah digunakan untuk memberikan dukungan hari ini.";
  }
  if (code.includes("ALREADYVOTED")) {
    return "Kamu sudah mendukung peserta ini hari ini (terdeteksi dari perangkat/nomor/email). Kembali lagi besok!";
  }
  if (code.includes("MISSINGDATA")) {
    return "Lengkapi data dulu (nama, nomor WhatsApp, email, status).";
  }
  if (code.includes("SELFVOTE")) {
    return "Kamu tidak bisa mendukung dirimu sendiri.";
  }
  if (code.includes("PHONE_NAME")) {
    return "Nomor WhatsApp ini sudah terdaftar dengan nama lain. Gunakan nama yang sama seperti sebelumnya.";
  }
  if (code.includes("WRONGSCHOOL")) {
    return "Kamu hanya dapat mendukung peserta dari sekolahmu sendiri.";
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
  if (code.includes("FAV_LIMIT")) {
    return "Kamu sudah memilih 10 peserta favorit hari ini. Vote favorit (+20) terbatas 10 peserta per hari.";
  }
  if (code.includes("IPLIMIT")) {
    return "Terlalu banyak akun memberikan dukungan dari jaringan ini hari ini. Coba lagi besok atau gunakan jaringan lain.";
  }
  return "Gagal memberikan dukungan. Silakan coba lagi.";
}
