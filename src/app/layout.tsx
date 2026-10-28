import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/toast";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Milestone English | Outcome-Based English Learning with Measurable Progress",
    template: "%s | Milestone English",
  },
  description:
    "12 program bahasa Inggris dengan kelas kecil 4–6 peserta, placement test gratis, rubrik yang jelas, dan laporan progres terukur.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
