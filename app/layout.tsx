import type { Metadata } from "next";
import { Inter, Titillium_Web } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const titillium = Titillium_Web({ variable: "--font-titillium", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Beep Job Hub · Fresher jobs & internships in India",
  description: "Live, deduplicated fresher jobs and internships in India, tagged by role and city, refreshed every day.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${titillium.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
