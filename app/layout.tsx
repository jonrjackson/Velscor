import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Velscor",
  description: "AI-powered email threat detection for Outlook",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
