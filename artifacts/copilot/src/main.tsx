import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { setBaseUrl } from "@workspace/api-client-react";

// Configure the API client to use the Railway backend
setBaseUrl(
  import.meta.env.VITE_API_URL ||
    "https://workspaceapi-server-production-cef7.up.railway.app"
);

createRoot(document.getElementById("root")!).render(<App />);