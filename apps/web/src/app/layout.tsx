import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import StorageNotice from "@/components/site/StorageNotice";
import { getSiteSettings } from "@/lib/strapi/siteSettings";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();

  return {
    title: siteSettings.defaultSeoTitle ?? siteSettings.siteName,
    description: siteSettings.defaultSeoDescription ?? "",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteSettings = await getSiteSettings();
  const cmsBaseUrl = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL ?? "";

  const faviconUrl = siteSettings.favicon?.url
    ? `${cmsBaseUrl.replace(/\/$/, "")}${siteSettings.favicon.url}`
    : null;

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
        <script
            dangerouslySetInnerHTML={{
              __html: `
          (function () {
            try {
              var stored = localStorage.getItem('theme'); // 'light' | 'dark' | null
              var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              var useDark = stored ? stored === 'dark' : prefersDark;
              var root = document.documentElement;
              if (useDark) root.classList.add('dark');
              else root.classList.remove('dark');
            } catch (e) {}
          })();
          `,
            }}
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <StorageNotice />
      </body>
    </html>
  );
}
