import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "KnowValue",
  description: "暗闇の中から、本当に価値ある情報を見つけ出す。",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <Script id="ga" strategy="afterInteractive">
            {`
              (() => {
                const trackedHostnames = new Set(['knowvalue.jp', 'www.knowvalue.jp']);
                const disableAnalytics =
                  navigator.webdriver === true ||
                  !trackedHostnames.has(window.location.hostname);

                window.__KV_GA_DISABLED__ = disableAnalytics;

                if (!disableAnalytics) {
                  window.dataLayer = window.dataLayer || [];
                  window.gtag = function(){window.dataLayer.push(arguments);};

                  const gaScript = document.createElement('script');
                  gaScript.async = true;
                  gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}';
                  document.head.appendChild(gaScript);

                  window.gtag('js', new Date());
                  window.gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
                  window.dispatchEvent(new Event('knowvalue:ga-ready'));
                }
              })();
            `}
          </Script>
        )}
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
