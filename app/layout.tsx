import "./globals.css";
import { Inter } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';


const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Landhacker - AI-Powered Land Investment",
  description:
    "Automate land investing with AI-driven comp analysis, geographic parcel selection, and marketing workflows.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        {/* Navigation Bar */}
        <nav className="sticky top-0 z-20 w-full px-8 py-4 bg-white border-b border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-2">
              <img
                src="/Landhacker.svg"
                alt="Landhacker Logo"
                className="w-8 h-8 dark:invert"
              />
              <span className="text-lg font-semibold">Landhacker</span>
            </div>
            <div className="flex gap-6">
              <a
                href="/login"
                className="text-sm hover:text-blue-600 dark:hover:text-blue-400"
              >
                Login
              </a>
              <a
                href="https://discord.gg/landhacker" // Replace with actual Discord link
                className="text-sm hover:text-blue-600 dark:hover:text-blue-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                Community
              </a>
              <a
                href="/api/py/helloFastApi"
                className="text-sm hover:text-blue-600 dark:hover:text-blue-400"
              >
                API
              </a>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="min-h-screen">{children}</main>

        {/* Footer */}
        <footer className="w-full py-6 text-center bg-gray-100 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Landhacker. All rights reserved.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Built with Next.js 15, Supabase, and OpenAI API. Hosted on Vercel.
          </p>
        </footer>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}