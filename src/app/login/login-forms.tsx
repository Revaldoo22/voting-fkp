"use client";

import * as React from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchoolsWithParticipants } from "@/lib/queries";
import { getFingerprint } from "@/lib/fingerprint";
import {
  voterRegisterSchema,
  voterSignInSchema,
  type VoterRegisterInput,
  type VoterSignInInput,
} from "@/lib/validations";

export function LoginForms() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { data: schools, isLoading: schoolsLoading } =
    useSchoolsWithParticipants();
  const [fingerprint, setFingerprint] = React.useState("");
  const [tab, setTab] = React.useState("signin");

  React.useEffect(() => {
    getFingerprint().then(setFingerprint).catch(() => setFingerprint(""));
  }, []);

  // -------------------- Register --------------------
  const reg = useForm<VoterRegisterInput>({
    resolver: zodResolver(voterRegisterSchema),
    defaultValues: {
      name: "",
      origin_school_name: "",
      school_id: "",
      voter_status: undefined,
      phone_number: "",
      password: "",
      confirm: "",
    },
  });

  async function onRegister(values: VoterRegisterInput) {
    const res = await fetch("/api/auth/voter/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, fingerprint }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Gagal mendaftar.");
      return;
    }
    toast.success("Pendaftaran berhasil! Silakan masuk.");
    signIn.setValue("phone_number", values.phone_number);
    reg.reset();
    setTab("signin");
  }

  // -------------------- Sign in --------------------
  const signIn = useForm<VoterSignInInput>({
    resolver: zodResolver(voterSignInSchema),
    defaultValues: { phone_number: "", password: "" },
  });

  async function onSignIn(values: VoterSignInInput) {
    const res = await fetch("/api/auth/voter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, fingerprint }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Gagal masuk.");
      return;
    }
    toast.success("Selamat datang! 🎉");
    router.push(next ?? data.redirect ?? "/voter/dashboard");
    router.refresh();
  }

  const noSchools = !schoolsLoading && schools && schools.length === 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto flex items-center gap-2 font-bold">
            <GraduationCap className="h-7 w-7 text-primary" />
            Festival Karakter Pelajar
          </Link>
          <CardTitle className="pt-2 text-lg">Voter / Pendukung</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Masuk</TabsTrigger>
              <TabsTrigger value="register">Daftar</TabsTrigger>
            </TabsList>

            {/* Sign in */}
            <TabsContent value="signin">
              <form onSubmit={signIn.handleSubmit(onSignIn)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="s-phone">Nomor WhatsApp</Label>
                  <Input
                    id="s-phone"
                    placeholder="0812xxxxxxxx"
                    inputMode="tel"
                    {...signIn.register("phone_number")}
                  />
                  {signIn.formState.errors.phone_number && (
                    <p className="text-xs text-destructive">
                      {signIn.formState.errors.phone_number.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-pass">Password</Label>
                  <Input
                    id="s-pass"
                    type="password"
                    {...signIn.register("password")}
                  />
                  {signIn.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {signIn.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={signIn.formState.isSubmitting || !fingerprint}
                >
                  {signIn.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {fingerprint ? "Masuk" : "Menyiapkan..."}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("register")}
                    className="text-primary hover:underline"
                  >
                    Daftar di sini
                  </button>
                </p>
              </form>
            </TabsContent>

            {/* Register */}
            <TabsContent value="register">
              <form onSubmit={reg.handleSubmit(onRegister)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="r-name">Nama Lengkap</Label>
                  <Input id="r-name" {...reg.register("name")} />
                  {reg.formState.errors.name && (
                    <p className="text-xs text-destructive">
                      {reg.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="r-origin-school">Nama sekolahmu</Label>
                  <Input
                    id="r-origin-school"
                    placeholder="Ketik nama sekolahmu"
                    {...reg.register("origin_school_name")}
                  />
                  {reg.formState.errors.origin_school_name && (
                    <p className="text-xs text-destructive">
                      {reg.formState.errors.origin_school_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Sekolah peserta yang kamu dukung</Label>
                  <Select
                    onValueChange={(v) =>
                      reg.setValue("school_id", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          schoolsLoading
                            ? "Memuat..."
                            : "Pilih sekolah peserta"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {schools?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {noSchools && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada sekolah dengan peserta. Tunggu panitia menambah
                      peserta dulu.
                    </p>
                  )}
                  {reg.formState.errors.school_id && (
                    <p className="text-xs text-destructive">
                      {reg.formState.errors.school_id.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Status kamu</Label>
                  <Select
                    onValueChange={(v) =>
                      reg.setValue(
                        "voter_status",
                        v as VoterRegisterInput["voter_status"],
                        { shouldValidate: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guru">Guru</SelectItem>
                      <SelectItem value="teman_luar_sekolah">
                        Teman di luar sekolah
                      </SelectItem>
                      <SelectItem value="teman_siswa_sekolah">
                        Teman siswa sekolah
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {reg.formState.errors.voter_status && (
                    <p className="text-xs text-destructive">
                      {reg.formState.errors.voter_status.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="r-phone">Nomor WhatsApp</Label>
                  <Input
                    id="r-phone"
                    placeholder="0812xxxxxxxx"
                    inputMode="tel"
                    {...reg.register("phone_number")}
                  />
                  {reg.formState.errors.phone_number && (
                    <p className="text-xs text-destructive">
                      {reg.formState.errors.phone_number.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="r-pass">Password</Label>
                  <Input
                    id="r-pass"
                    type="password"
                    {...reg.register("password")}
                  />
                  {reg.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {reg.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="r-confirm">Konfirmasi Password</Label>
                  <Input
                    id="r-confirm"
                    type="password"
                    {...reg.register("confirm")}
                  />
                  {reg.formState.errors.confirm && (
                    <p className="text-xs text-destructive">
                      {reg.formState.errors.confirm.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={reg.formState.isSubmitting || !fingerprint}
                >
                  {reg.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {fingerprint ? "Daftar" : "Menyiapkan..."}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  1 nomor WhatsApp = 1 akun. 1 perangkat hanya untuk 1 akun.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
