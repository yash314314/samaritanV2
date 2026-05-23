import "./globals.css";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { AppProvider } from "../context/AppContext";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <div className="flex min-h-screen bg-[#0a0a0a] text-white h-screen">
            <Sidebar />

            <main className="flex-1 p-10 overflow-y-auto">
              <TopBar />
              {children}
            </main>

          </div>
        </AppProvider>
      </body>
    </html>
  );
}