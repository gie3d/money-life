import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import Nav from "@/components/Nav";
import UpdateBanner from "@/components/UpdateBanner";
import { appVersion } from "@/lib/version";
import { btcRates } from "@/lib/btc";
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
  // Added to the iPhone home screen it opens like an app, under its own name.
  appleWebApp: { capable: true, title: "Money Life", statusBarStyle: "default" },
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
      <body className={`min-h-full flex flex-col ${user ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0" : ""}`}>
        <Nav userName={user?.name ?? null} btc={user && (await btcRates(user.id)) ? { on: user.btcStandard } : null} />
        {user?.btcStandard && (
          <p role="status" className="bg-brand-soft px-4 py-2 text-center text-xs font-semibold text-brand">
            BTC Standard is on: amounts are shown in BTC. Prices and balances are still updated in your own currency; other changes need it off. <Link href="/settings" className="underline">Settings</Link>
          </p>
        )}
        <main className="flex-1 w-full">{children}</main>
        <footer className="flex items-center justify-center gap-3 px-4 py-6 text-xs text-ink-3">
          <span className="num">Money Life v{pkg.version}</span>
          <span aria-hidden>·</span>
          <Link href="/releases" className="font-semibold hover:underline">Release notes</Link>
        </footer>
        <UpdateBanner version={appVersion()} />
      </body>
    </html>
  );
}
