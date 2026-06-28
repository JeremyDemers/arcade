import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arcade | Tetris",
  description: "A polished SaaS arcade Tetris experience with accounts and leaderboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
