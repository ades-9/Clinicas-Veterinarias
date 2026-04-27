import { useAuth } from "@clerk/clerk-react";
import axios from "axios";
import { useMemo } from "react";

const baseURL = import.meta.env.VITE_API_URL || "";

export function useApiClient() {
  const { getToken } = useAuth();

  return useMemo(() => {
    const client = axios.create({ baseURL });
    client.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return client;
  }, [getToken]);
}
