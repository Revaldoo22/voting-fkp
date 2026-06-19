import { Suspense } from "react";
import { CredentialLogin } from "../credential-login";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <CredentialLogin
        role="admin"
        title="Login Admin"
        hint="Khusus panitia/administrator."
      />
    </Suspense>
  );
}
