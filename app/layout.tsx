import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CompactLab | Midnight Smart Contract IDE",
  description:
    "Browser-based IDE for writing, compiling, and deploying Compact smart contracts on Midnight Preprod.",
  applicationName: "Compact Lab",
  icons: {
    icon: [
      { url: "/cl-icon.png", type: "image/png" },
      { url: "/cl-logo.ico", sizes: "32x32" },
    ],
    apple: [{ url: "/cl-icon.png" }],
    shortcut: ["/cl-logo.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden bg-background text-text-primary antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
