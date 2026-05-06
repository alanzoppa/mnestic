import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SidebarLayout from "@/components/SidebarLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { KonamiDetector } from "@/components/KonamiDetector";
import QueryProvider from "@/components/QueryProvider";
import { PageTransition } from "@/components/PageTransition";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

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
    <html lang="en" className={`dark ${geist.variable}`}>
      <body className="bg-zinc-950 text-zinc-100">
        <SidebarLayout>
          <ErrorBoundary>
            <KeyboardShortcuts />
            <KonamiDetector />
            <PageTransition>
              <QueryProvider>{children}</QueryProvider>
            </PageTransition>
          </ErrorBoundary>
        </SidebarLayout>
      </body>
    </html>
  );
}
