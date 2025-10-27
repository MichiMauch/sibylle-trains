import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SBB Abfahrtstafel - Muhen → Aarau → Zürich HB",
  description: "Live-Abfahrtszeiten und Anschlusszüge von Muhen über Aarau nach Zürich HB",
  manifest: "/manifest.json",
  themeColor: "#2E327B",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SBB Abfahrtstafel",
  },
  icons: {
    icon: "/logos/favicon.ico",
    apple: "/logos/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
