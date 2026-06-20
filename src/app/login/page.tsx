import Link from "next/link";
import { GraduationCap, Shield, UserSquare2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginChooserPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto flex items-center gap-2 font-bold">
            <GraduationCap className="h-7 w-7 text-primary" />
            Festival Karakter Pelajar
          </Link>
          <CardTitle className="pt-2 text-lg">Masuk sebagai</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" asChild>
            <Link href="/login/peserta">
              <UserSquare2 className="h-4 w-4" /> Peserta
            </Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login/admin">
              <Shield className="h-4 w-4" /> Admin / Panitia
            </Link>
          </Button>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            Pendukung (voter) tidak perlu login — langsung pilih peserta di{" "}
            <Link href="/" className="text-primary hover:underline">
              halaman utama
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
