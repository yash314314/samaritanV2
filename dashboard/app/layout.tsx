import "./globals.css";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { AppProvider } from "../context/AppContext";
import { WsProvider } from "../components/WsProvider";
import ElectronFocusBridge from "../components/ElectronFocusBridge";
import SmartBreakController from "../components/SmartBreakController";
import PageScrollBridge from "../components/PageScrollBridge";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <WsProvider>
            <div className="flex min-h-screen bg-[#050506] text-zinc-100">
              <ElectronFocusBridge />
              <SmartBreakController />
              <PageScrollBridge />
              <Sidebar />

              <main className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <TopBar />
                <div className="min-h-0 flex-1 pb-8">{children}</div>
              </main>

            </div>
          </WsProvider>
        </AppProvider>
      </body>
    </html>
  );
}
