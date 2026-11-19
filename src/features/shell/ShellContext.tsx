"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Panel = "menu" | "search" | "bag" | null;

interface ShellApi {
  readonly panel: Panel;
  readonly open: (panel: Exclude<Panel, null>) => void;
  readonly close: () => void;
}

const ShellContext = createContext<ShellApi | null>(null);

export function ShellProvider({ children }: { readonly children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const api = useMemo<ShellApi>(
    () => ({ panel, open: setPanel, close: () => setPanel(null) }),
    [panel],
  );
  return <ShellContext.Provider value={api}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellApi {
  const api = useContext(ShellContext);
  if (!api) throw new Error("useShell must be used inside ShellProvider");
  return api;
}
