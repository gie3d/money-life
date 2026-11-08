import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import { getUser } from "@/lib/session";
import pkg from "../package.json";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  // Pages set only their own name; renaming the app is a one-line change.
  title: { default: "Money Life", template: "%s · Money Life" },
  description: "Track what you own, and how it performs.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

const themeScript = `
try {
  var t = localStorage.getItem('ml-theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Sets the saved theme before the page paints. Next injects it into the HTML itself, so React never renders a script tag. */}
        <Script id="theme" strategy="beforeInteractive">{themeScript}</Script>
      </head>
      <body className="min-h-full flex flex-col">
        <Nav userName={user?.name ?? null} />
        <main className="flex-1 w-full">{children}</main>
        <footer className="flex items-center justify-center gap-3 px-4 py-6 text-xs text-ink-3">
          <span className="num">Money Life v{pkg.version}</span>
          <span aria-hidden>·</span>
          <Link href="/releases" className="font-semibold hover:underline">Release notes</Link>
        </footer>
      </body>
    </html>
  );
}
