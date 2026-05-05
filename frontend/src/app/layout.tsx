import type { Metadata } from "next";
import "./globals.css";
import SidebarLayout from "@/components/SidebarLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import QueryProvider from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "Mnestic",
  description: "Private knowledge browser with semantic search",
  openGraph: {
    title: "Mnestic",
    description: "Private knowledge browser with semantic search",
    images: ["/mnestic.png"],
  },
  twitter: {
    title: "Mnestic",
    description: "Private knowledge browser with semantic search",
    card: "summary",
    images: ["/mnestic.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100">
        <SidebarLayout>
          <ErrorBoundary>
            <KeyboardShortcuts />
            <QueryProvider>{children}</QueryProvider>
          </ErrorBoundary>
        </SidebarLayout>
      </body>
    </html>
  );
}
