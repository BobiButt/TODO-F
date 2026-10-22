import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "@/App";
import { RoleProvider } from "@/context/RoleContext";
import { AuthProvider } from "@/context/AuthContext";
import { setAuthToken } from "@/api/client";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <RoleProvider>
        <App />
        <Toaster theme="dark" position="bottom-right" />
      </RoleProvider>
    </AuthProvider>
  </React.StrictMode>,
);

// Inject stored JWT token into the API client so outgoing requests carry it.
const token = localStorage.getItem("taskflow_token");
if (token) {
  setAuthToken(token);
}