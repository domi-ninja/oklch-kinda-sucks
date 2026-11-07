import { useLayoutEffect, useMemo, useRef } from "react";
import { demoDocument } from "./demo";
import axeUrl from "axe-core/axe.min.js?url";
import previewA11y from "./previewA11y.js?raw";
import previewBridge from "./previewBridge.js?raw";
import type { Workspace } from "./workspaceSchema";

export function PreviewFrame({
  css,
  colors,
  dark,
  width,
}: {
  css: string;
  colors?: Record<string, string>;
  dark: boolean;
  width: Workspace["width"];
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latestTheme = useRef({ css, colors });
  const document = useMemo(
    () =>
      demoDocument("", false, dark, {
        script: previewBridge + "\n" + previewA11y,
        scripts: [new URL(axeUrl, window.location.href).href],
      }),
    [dark],
  );
  const sendStyles = () =>
    frame.current?.contentWindow?.postMessage(
      { type: "preview-theme", ...latestTheme.current },
      "*",
    );
  useLayoutEffect(
    function updatePreviewStyles() {
      latestTheme.current = { css, colors };
      sendStyles();
    },
    [css, colors],
  );
  return (
    <iframe
      ref={frame}
      data-preview-mode={dark ? "dark" : "light"}
      title={`shadcn/ui ${dark ? "dark" : "light"} preview`}
      sandbox="allow-scripts allow-forms"
      srcDoc={document}
      onLoad={sendStyles}
      style={{ width, maxWidth: "100%" }}
    />
  );
}
