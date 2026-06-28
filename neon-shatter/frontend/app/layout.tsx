import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arcade | Neon Shatter",
  description: "Smash the neon grid, chase combos, and climb the arcade leaderboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
