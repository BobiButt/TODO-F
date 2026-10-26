import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "@/App";
import { RoleProvider } from "@/context/RoleContext";
import { AuthProvider } from "@/context/AuthContext";
import { TaskProvider } from "@/context/TaskContext";
import { setAuthToken } from "@/api/client";
import "@/index.css";

// Configure TanStack Query with aggressive caching to reduce database load
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // Hold in cache for 30 minutes
      gcTime: 1000 * 60 * 60 * 24, // Keep in memory for 24 hours
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoleProvider>
          <TaskProvider>
            <App />
            <Toaster theme="dark" position="bottom-right" />
          </TaskProvider>
        </RoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

// Inject stored JWT token into the API client so outgoing requests carry it.
const token = localStorage.getItem("taskflow_token");
if (token) {
  setAuthToken(token);
}