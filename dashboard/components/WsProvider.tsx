"use client";

import { useEffect, ReactNode } from "react";
import { getWsClient } from "@/lib/ws";

export function WsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const client = getWsClient();
    client.connect();
    return () => client.disconnect();
  }, []);

  return <>{children}</>;
}