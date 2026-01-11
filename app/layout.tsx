import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicalNoteTool",
  description: "Restructure anonymised clinical text into a structured note (no storage)."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased leading-[1.55] selection:bg-amber-200 selection:text-slate-900">
        {children}
      </body>
    </html>
  );
}


