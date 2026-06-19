"use client";

import {
  LayoutDashboard,
  GraduationCap,
  ClipboardCheck,
  Trophy,
  School,
} from "lucide-react";
import { Navbar } from "@/components/navbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Navbar
        links={[
          { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/admin/participants", label: "Peserta", icon: GraduationCap },
          { href: "/admin/submissions", label: "Submission", icon: ClipboardCheck },
          { href: "/admin/quests", label: "Quest", icon: Trophy },
          { href: "/admin/schools", label: "Sekolah", icon: School },
        ]}
        showLogout
      />
      <main className="container space-y-6 py-8">{children}</main>
    </div>
  );
}
