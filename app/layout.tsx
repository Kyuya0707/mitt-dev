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
                const analyticsStorageKey = 'knowvalue:analytics-opt-out';
                const analyticsMode = new URLSearchParams(window.location.search).get('kv_ga');
                let explicitlyOptedOut = false;

                try {
                  if (analyticsMode === 'off') {
                    window.localStorage.setItem(analyticsStorageKey, '1');
                  } else if (analyticsMode === 'on') {
                    window.localStorage.removeItem(analyticsStorageKey);
                  }

                  explicitlyOptedOut =
                    window.localStorage.getItem(analyticsStorageKey) === '1';
                } catch {
                  explicitlyOptedOut = analyticsMode === 'off';
                }

                if (analyticsMode === 'off' || analyticsMode === 'on') {
                  const cleanUrl = new URL(window.location.href);
                  cleanUrl.searchParams.delete('kv_ga');
                  window.history.replaceState(
                    window.history.state,
                    '',
                    cleanUrl.pathname + cleanUrl.search + cleanUrl.hash,
                  );
                }

                const disableAnalytics =
                  navigator.webdriver === true ||
                  explicitlyOptedOut ||
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
