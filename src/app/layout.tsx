import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Anton, Montserrat } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const montserrat = Montserrat({
  weight: ["400", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HARDWIG: EMPIRE MODE",
  description: "Kempen Vice — persoonlijk operating system.",
  applicationName: "EMPIRE MODE",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EMPIRE",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B0907",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl" data-theme="dark">
      <body className={`${anton.variable} ${montserrat.variable}`}>
        <div className="app-shell">{children}</div>
        <PwaRegister />
      </body>
    </html>
  );
}
