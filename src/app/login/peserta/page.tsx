import { Suspense } from "react";
import { CredentialLogin } from "../credential-login";

export default function PesertaLoginPage() {
  return (
    <Suspense>
      <CredentialLogin
        role="participant"
        title="Login Peserta"
        hint="Gunakan nomor WhatsApp & password dari panitia."
      />
    </Suspense>
  );
}
