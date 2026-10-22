import "./globals.css";
import "./motion.css";
import { fontVariables } from "./fonts";
import AppChrome from "../components/AppChrome";
import { AppProvider } from "../context/AppContext";
import { AppearanceProvider } from "../context/AppearanceContext";
import { AuthProvider } from "../context/AuthContext";
import { TourProvider } from "../context/TourContext";
import { WsProvider } from "../components/WsProvider";
import { appearanceScript } from "../lib/appearance";
import { bootScript } from "../lib/motionBoot";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    // The <head> script below sets appearance variables on <html> before
    // hydration, so React must not treat those attributes as a mismatch.
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceScript() }} />
        <script dangerouslySetInnerHTML={{ __html: bootScript() }} />
      </head>
      <body>
        <AppearanceProvider>
          <AuthProvider>
            <AppProvider>
              <TourProvider>
                <WsProvider>
                  <AppChrome>{children}</AppChrome>
                </WsProvider>
              </TourProvider>
            </AppProvider>
          </AuthProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
