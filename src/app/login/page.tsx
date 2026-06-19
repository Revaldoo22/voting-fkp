import { Suspense } from "react";
import { LoginForms } from "./login-forms";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForms />
    </Suspense>
  );
}
