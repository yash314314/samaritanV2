import "./globals.css";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { AppProvider } from "../context/AppContext";
import { WsProvider } from "../components/WsProvider";
import ElectronFocusBridge from "../components/ElectronFocusBridge";

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
            <div className="flex h-screen min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
              <ElectronFocusBridge />
              <Sidebar />

              <main className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 lg:p-5">
                <TopBar />
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
              </main>

            </div>
          </WsProvider>
        </AppProvider>
      </body>
    </html>
  );
}
