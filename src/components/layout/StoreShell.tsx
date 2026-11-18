import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/Toast";
import { BagSheet } from "@/features/cart/BagSheet";
import { KeyboardWatcher } from "@/features/shell/KeyboardWatcher";
import { MenuSheet } from "@/features/shell/MenuSheet";
import { SearchSheet } from "@/features/shell/SearchSheet";
import { ShellProvider } from "@/features/shell/ShellContext";
import { WhatsAppButton } from "@/features/shell/WhatsAppButton";

export function StoreShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ShellProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-surface focus:p-3"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <BottomNav />
        <MenuSheet />
        <SearchSheet />
        <BagSheet />
        <WhatsAppButton />
        <KeyboardWatcher />
      </ShellProvider>
    </ToastProvider>
  );
}
