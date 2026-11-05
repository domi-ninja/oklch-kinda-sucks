import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";
import { loadShare } from "./sharing";
import { Button } from "./components/ui/button";

const root = createRoot(document.getElementById("root")!);
async function start() {
  const share = location.pathname.match(/^\/share\/([\w-]{16})$/);
  if (share)
    root.render(
      <p className="p-4" role="status">
        Opening shared workspace…
      </p>,
    );
  try {
    const shared = share ? await loadShare(share[1]) : undefined;
    root.render(
      <React.StrictMode>
        <App shared={shared} />
      </React.StrictMode>,
    );
  } catch (error) {
    root.render(
      <div className="p-4 flex flex-col gap-4 items-start">
        <p role="alert">
          {error instanceof Error
            ? error.message
            : "Could not open share link."}
        </p>
        <Button variant="outline" onClick={() => location.reload()}>
          Try again
        </Button>
        <Button variant="outline" asChild>
          <a href="/">Open workspace</a>
        </Button>
      </div>,
    );
  }
}
void start();
