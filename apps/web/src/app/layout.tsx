import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/lib/providers.tsx";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  description:
    "Optimize a campus microgrid: solar, battery and grid dispatch over a 24-hour day.",
  title: {
    default: "GridWise",
    template: "%s · GridWise",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      lang="en"
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
