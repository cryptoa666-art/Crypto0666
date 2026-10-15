import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { registerCryptoPwa } from "@/lib/pwa";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    registerCryptoPwa();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          dir="rtl"
          toastOptions={{
            classNames: {
              toast: "bg-surface-2 text-fg border-border font-sans",
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
