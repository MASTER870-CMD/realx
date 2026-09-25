import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ReelX - Premium Short-Form Video Platform",
    template: "%s | ReelX"
  },
  description: "Experience the next generation of short-form video. ReelX features a personalized, engagement-driven recommendation engine, seamless vertical playback, and a premium glassmorphism UI.",
  keywords: ["ReelX", "short-form video platform", "personalized video feed", "video recommendation system", "social video platform", "Next.js video platform", "React video platform", "PWA"],
  authors: [{ name: "MASTER870-CMD" }],
  creator: "MASTER870-CMD",
  publisher: "ReelX",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "ReelX - Premium Short-Form Video Platform",
    description: "Experience the next generation of short-form video with a personalized, engagement-driven recommendation engine.",
    url: "https://realx.vercel.app",
    siteName: "ReelX",
    images: [
      {
        url: "/logo.jpg",
        width: 800,
        height: 800,
        alt: "ReelX Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReelX - Premium Short-Form Video Platform",
    description: "Experience the next generation of short-form video with a personalized, engagement-driven recommendation engine.",
    images: ["/logo.jpg"],
  },
  manifest: "/manifest.json",
  appleWebApp: { 
    capable: true, 
    statusBarStyle: "black-translucent", 
    title: "ReelX" 
  },
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  }
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
