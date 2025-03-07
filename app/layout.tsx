import "./globals.css";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react"; // 🔴 NEW IMPORT 🔴

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Landhacker - AI-Powered Land Investment",
  description:
    "Automate land investing with AI-driven comp analysis, geographic parcel selection, and marketing workflows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        {/* Navigation Bar */}
        <nav className="sticky top-0 z-20 w-full px-8 py-4 bg-white border-b border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          {/* ... (existing nav content) ... */}
        </nav>

        {/* Main Content */}
        <main className="min-h-screen">{children}</main>

        {/* Footer */}
        <footer className="w-full py-6 text-center bg-gray-100 dark:bg-gray-800">
          {/* ... (existing footer content) ... */}
        </footer>

        {/* 🔴 Add the Analytics component LAST in the body 🔴 */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}