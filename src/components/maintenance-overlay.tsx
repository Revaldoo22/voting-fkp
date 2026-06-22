import { Wrench } from "lucide-react";

/** Full-screen overlay shown when NEXT_PUBLIC_MAINTENANCE=true. */
export function MaintenanceOverlay() {
  if (process.env.NEXT_PUBLIC_MAINTENANCE !== "true") return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-primary via-blue-600 to-blue-700 p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Wrench className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Sedang Dalam Perbaikan
        </h1>
        <p className="text-muted-foreground">
          Website Festival Karakter Pelajar sedang dalam pemeliharaan sebentar.
          Silakan kembali lagi nanti. Terima kasih atas pengertiannya 🙏
        </p>
      </div>
    </div>
  );
}
