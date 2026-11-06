import { useLayoutEffect, useMemo, useRef } from "react";
import { demoDocument } from "./demo";
import previewBridge from "./previewBridge.js?raw";
import type { Workspace } from "./workspaceSchema";

export function PreviewFrame({
  css,
  dark,
  width,
}: {
  css: string;
  dark: boolean;
  width: Workspace["width"];
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latestCss = useRef(css);
  const document = useMemo(
    () => demoDocument("", false, dark, { script: previewBridge }),
    [dark],
  );
  const sendStyles = () =>
    frame.current?.contentWindow?.postMessage(
      { type: "preview-theme", css: latestCss.current },
      "*",
    );
  useLayoutEffect(
    function updatePreviewStyles() {
      latestCss.current = css;
      sendStyles();
    },
    [css],
  );
  return (
    <iframe
      ref={frame}
      data-preview-mode={dark ? "dark" : "light"}
      title={`shadcn/ui ${dark ? "dark" : "light"} preview`}
      sandbox="allow-scripts"
      srcDoc={document}
      onLoad={sendStyles}
      style={{ width, maxWidth: "100%" }}
    />
  );
}
