"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  credentialLoginSchema,
  type CredentialLoginInput,
} from "@/lib/validations";

/** Shared password login used by /login/admin and /login/peserta. */
export function CredentialLogin({
  role,
  title,
  hint,
}: {
  role: "admin" | "participant";
  title: string;
  hint: string;
}) {
  const router = useRouter();
  const next = useSearchParams().get("next");

  const form = useForm<CredentialLoginInput>({
    resolver: zodResolver(credentialLoginSchema),
    defaultValues: { identifier: "", password: "", expected_role: role },
  });

  async function onSubmit(values: CredentialLoginInput) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, expected_role: role }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Gagal masuk.");
      return;
    }
    toast.success("Berhasil masuk.");
    router.push(next ?? data.redirect ?? "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto flex items-center gap-2 font-bold">
            <GraduationCap className="h-7 w-7 text-primary" />
            Festival Karakter Pelajar
          </Link>
          <CardTitle className="pt-2 text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-id">
                {role === "participant" ? "Nama atau Nomor WhatsApp" : "Nomor WhatsApp"}
              </Label>
              <Input
                id="c-id"
                placeholder={
                  role === "participant" ? "Nama lengkap / 0812xxxxxxxx" : "0812xxxxxxxx"
                }
                {...form.register("identifier")}
              />
              {form.formState.errors.identifier && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.identifier.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-pass">Password</Label>
              <Input id="c-pass" type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Masuk
            </Button>
            <p className="text-center text-xs text-muted-foreground">{hint}</p>
            <p className="text-center text-xs">
              <Link href="/login" className="text-primary hover:underline">
                Masuk sebagai Voter / Pendukung
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
