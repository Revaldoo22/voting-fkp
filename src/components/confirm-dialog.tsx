"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmState = {
  title: string;
  description?: string;
  confirmText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
};

const ConfirmCtx = React.createContext<(s: ConfirmState) => void>(() => {});

/** Wrap a subtree to enable useConfirm(). */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState | null>(null);
  const [busy, setBusy] = React.useState(false);

  const confirm = React.useCallback((s: ConfirmState) => setState(s), []);

  async function handleConfirm() {
    if (!state) return;
    try {
      setBusy(true);
      await state.onConfirm();
      setState(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onOpenChange={(o) => !o && !busy && setState(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{state?.title}</DialogTitle>
            {state?.description && (
              <DialogDescription className="whitespace-pre-line">
                {state.description}
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setState(null)}
              disabled={busy}
            >
              Batal
            </Button>
            <Button
              variant={state?.variant === "destructive" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {state?.confirmText ?? "Ya, lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

/** Returns a function to open a confirm dialog. Resolves via onConfirm callback. */
export function useConfirm() {
  return React.useContext(ConfirmCtx);
}
