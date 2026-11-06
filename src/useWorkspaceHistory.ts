import { useEffect, useReducer, useRef } from "react";
import {
  createHistory,
  workspaceHistory,
  type WorkspaceChange,
} from "./workspaceHistory";
import type { Workspace } from "./workspaceSchema";

function isTextEditor(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest(
      'textarea,input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),[contenteditable]:not([contenteditable="false"])',
    )
  );
}

export function useWorkspaceHistory(initial: () => Workspace) {
  const [history, dispatch] = useReducer(workspaceHistory, undefined, () =>
    createHistory(initial()),
  );
  const interaction = useRef<object | null>(null);
  const textEdit = useRef<object | null>(null);
  const batch = useRef<object | null>(null);

  function historyGroup() {
    if (!batch.current) {
      batch.current = {};
      queueMicrotask(() => {
        batch.current = null;
      });
    }
    return interaction.current ?? textEdit.current ?? batch.current;
  }
  function change(
    change: WorkspaceChange,
    record = true,
    group = historyGroup(),
  ) {
    dispatch({
      type: "change",
      change,
      record,
      group,
    });
  }
  const undo = () => dispatch({ type: "undo" });
  const redo = () => dispatch({ type: "redo" });

  useEffect(function groupWorkspaceInteractionsAndBindHistoryShortcuts() {
    const isDragControl = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest('.plane,input[type="range"]');
    const beginPointer = (event: PointerEvent) => {
      if (event.button === 0 && isDragControl(event.target))
        interaction.current = {};
    };
    const endInteraction = () => {
      const group = interaction.current;
      queueMicrotask(() => {
        if (interaction.current === group) interaction.current = null;
      });
    };
    const beginText = (event: FocusEvent) => {
      textEdit.current = isTextEditor(event.target) ? {} : null;
    };
    const endText = () => {
      const group = textEdit.current;
      queueMicrotask(() => {
        if (textEdit.current === group) textEdit.current = null;
      });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !isTextEditor(event.target)
      ) {
        const key = event.key.toLowerCase();
        const type =
          key === "z"
            ? event.shiftKey
              ? "redo"
              : "undo"
            : key === "y" && !event.shiftKey
              ? "redo"
              : null;
        if (type) {
          event.preventDefault();
          dispatch({ type });
          return;
        }
      }
      if (
        !event.repeat &&
        isDragControl(event.target) &&
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "PageUp",
          "PageDown",
        ].includes(event.key)
      )
        interaction.current = {};
    };
    const onPreviewShortcut = (event: MessageEvent<unknown>) => {
      if (
        !event.data ||
        typeof event.data !== "object" ||
        !("type" in event.data) ||
        event.data.type !== "preview-history" ||
        !("action" in event.data)
      )
        return;
      const type = event.data.action;
      if (type !== "undo" && type !== "redo") return;
      if (
        ![
          ...document.querySelectorAll<HTMLIFrameElement>(
            "iframe[data-preview-mode]",
          ),
        ].some((frame) => frame.contentWindow === event.source)
      )
        return;
      dispatch({ type });
    };
    const clearInteraction = () => {
      interaction.current = null;
      textEdit.current = null;
    };
    window.addEventListener("pointerdown", beginPointer, true);
    window.addEventListener("pointerup", endInteraction, true);
    window.addEventListener("pointercancel", endInteraction, true);
    window.addEventListener("lostpointercapture", endInteraction, true);
    window.addEventListener("focusin", beginText, true);
    window.addEventListener("focusout", endText, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", endInteraction, true);
    window.addEventListener("blur", clearInteraction);
    window.addEventListener("message", onPreviewShortcut);
    return () => {
      window.removeEventListener("pointerdown", beginPointer, true);
      window.removeEventListener("pointerup", endInteraction, true);
      window.removeEventListener("pointercancel", endInteraction, true);
      window.removeEventListener("lostpointercapture", endInteraction, true);
      window.removeEventListener("focusin", beginText, true);
      window.removeEventListener("focusout", endText, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", endInteraction, true);
      window.removeEventListener("blur", clearInteraction);
      window.removeEventListener("message", onPreviewShortcut);
    };
  }, []);
  return {
    state: history.present,
    change,
    historyGroup,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
