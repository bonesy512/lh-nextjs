import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between min-h-screen p-8 md:p-24 bg-gray-50 dark:bg-gray-900">
      {/* Header Section */}
      <div className="z-10 w-full max-w-5xl font-mono text-sm lg:flex lg:items-center lg:justify-between">
        <div className="text-center lg:text-left">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Landhacker
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            AI-Powered Land Investment Automation
          </p>
        </div>
        <div className="mt-4 lg:mt-0">
          <Link
            href="/api/py/helloFastApi"
            className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Explore API
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative flex flex-col items-center mt-12 text-center lg:mt-20">
        <Image
          className="relative dark:drop-shadow-[0_0_0.3rem_#ffffff70] dark:invert"
          src="/Landhacker.svg"
          alt="Landhacker Logo"
          width={180}
          height={37}
          priority
        />
        <p className="max-w-2xl mt-6 text-lg text-gray-700 dark:text-gray-200">
          Automate land investment with AI-driven comp analysis, geographic
          parcel selection, and marketing workflows. Powered by AI and
          Stripe tokenized payments.
        </p>
        <div className="mt-8 space-x-4">
          <Link
            href="#features"
            className="px-6 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
          >
            Learn More
          </Link>
          <Link
            href="https://discord.gg/landhacker" // Replace with actual Discord link
            className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            Join Community
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div
        id="features"
        className="grid w-full max-w-5xl grid-cols-1 gap-8 mt-16 mb-16 text-center lg:grid-cols-3 lg:text-left"
      >
        <div className="p-6 transition-colors bg-white rounded-lg shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
          <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
            Parcel Exploration
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Explore land parcels with an interactive map and trigger Artificial Intelligence
            analysis instantly.
          </p>
        </div>
        <div className="p-6 transition-colors bg-white rounded-lg shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
          <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
            AI Comps Generation
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Get comparable sales analysis using Artificial Intelligence, MLS data, GOV records, and county
            records.
          </p>
        </div>
        <div className="p-6 transition-colors bg-white rounded-lg shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
          <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
            Automated Outreach
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Generate and customize direct mail campaigns for selected
            properties.
          </p>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="flex items-center justify-center w-full py-8 text-sm text-gray-500 dark:text-gray-400">
        Powered by{" "}
        <a
          href="https://vercel.com"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2"
        >
          <Image
            src="/AI APP FACTORY.svg"
            alt="AI App Factory Logo"
            className="dark:invert"
            width={100}
            height={24}
            priority
          />
        </a>
      </div>
    </main>
  );
}