"use client";

import * as React from "react";
import { Award, Gift, Smartphone, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Prize = { icon: React.ElementType; title: string; desc: string };

const VOTER_PRIZES: Prize[] = [
  { icon: Gift, title: "Tumbler Eksklusif", desc: "Untuk Top 5 voter teraktif." },
  { icon: Award, title: "Sertifikat", desc: "Penghargaan resmi sebagai pendukung teraktif." },
];

const PARTICIPANT_PRIZES: Prize[] = [
  { icon: Smartphone, title: "Smartphone", desc: "Untuk peserta dengan dukungan terbanyak." },
  { icon: Award, title: "Sertifikat", desc: "Penghargaan resmi Universitas STEKOM." },
  { icon: Star, title: "Duta Teladan STEKOM", desc: "Benefit khusus sebagai Duta Teladan Universitas STEKOM." },
];

function PrizeDialog({
  label,
  title,
  prizes,
  variant,
}: {
  label: string;
  title: string;
  prizes: Prize[];
  variant: "default" | "accent";
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" variant={variant} className="h-auto w-full py-4">
          <Trophy className="h-5 w-5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Hadiah yang diperebutkan.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {prizes.map((p) => (
            <li key={p.title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <p.icon className="h-5 w-5 text-primary" />
              </span>
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function PrizeButtons() {
  return (
    <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
      <PrizeDialog
        label="Hadiah Voter Terbaik"
        title="Hadiah Voter Terbaik"
        prizes={VOTER_PRIZES}
        variant="default"
      />
      <PrizeDialog
        label="Hadiah Peserta Terbaik"
        title="Hadiah Peserta Terbaik"
        prizes={PARTICIPANT_PRIZES}
        variant="accent"
      />
    </div>
  );
}
