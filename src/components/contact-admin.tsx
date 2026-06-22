"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const ADMIN_WA = "6282257425470"; // 082257425470
const MESSAGE = "Halo Admin Festival Karakter Pelajar, saya butuh bantuan.";

export function ContactAdminButton({
  className,
  size = "sm",
  label = "Hubungi Admin",
  message = MESSAGE,
}: {
  className?: string;
  size?: "sm" | "default" | "lg";
  label?: string;
  message?: string;
}) {
  const href = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(message)}`;
  return (
    <Button variant="outline" size={size} className={className} asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}
