"use client";

import { useApi } from "./useApi";
import { focusApi } from "@/lib/api";
import { ActiveStatus } from "@/app/types";

export function useActiveSession() {
  return useApi<ActiveStatus>(
    async () => {
      const { data } = await focusApi.getActiveStatus();
      return data;
    },
    { refetchInterval: 5000 }
  );
}