import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { SessionWrapper } from "@/components/providers/session-provider";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Context Manager",
  description:
    "Compose structured AI prompt contexts with templates, coins, and saves.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <SessionWrapper session={session}>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
