"use client";

import * as React from "react";
import { Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/queries";

export function EventToggle() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useSettings();
  const [busy, setBusy] = React.useState(false);

  const open = settings?.event_open ?? true;

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_open: !open }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal mengubah status event.");
        return;
      }
      toast.success(!open ? "Event dibuka." : "Event ditutup.");
      qc.invalidateQueries({ queryKey: ["settings"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              open ? "bg-emerald-500/10" : "bg-destructive/10"
            }`}
          >
            {open ? (
              <Unlock className="h-5 w-5 text-emerald-600" />
            ) : (
              <Lock className="h-5 w-5 text-destructive" />
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status Event</p>
            <div className="flex items-center gap-2">
              <p className="font-semibold">
                {isLoading ? "Memuat..." : open ? "Dibuka" : "Ditutup"}
              </p>
              <Badge variant={open ? "success" : "destructive"}>
                {open ? "Voting & Quest aktif" : "Voting & Quest nonaktif"}
              </Badge>
            </div>
          </div>
        </div>
        <Button
          variant={open ? "destructive" : "default"}
          onClick={toggle}
          disabled={busy || isLoading}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {open ? "Tutup Event" : "Buka Event"}
        </Button>
      </CardContent>
    </Card>
  );
}
