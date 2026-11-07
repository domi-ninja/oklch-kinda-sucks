export const demoBody = `<main class="min-h-screen bg-background text-foreground p-6 font-sans text-sm">
  <header class="flex flex-wrap gap-3 items-center justify-between border-b border-border pb-6 mb-6"><h1 class="font-semibold">Studio / projects</h1><span class="rounded-full bg-secondary px-3 py-2 text-secondary-foreground">Personal workspace</span></header>
  <div class="grid gap-6 md:grid-cols-2">
    <section class="rounded-xl border border-border bg-card p-6 text-card-foreground">
      <div class="flex justify-between gap-3 mb-6"><h2 id="project-heading" class="font-semibold">Website refresh</h2><span class="text-muted-foreground">01</span></div>
      <div class="h-2 rounded-full bg-primary/20 mb-6" role="progressbar" aria-label="Project progress" aria-valuenow="67" aria-valuemin="0" aria-valuemax="100"><div class="h-2 w-2/3 rounded-full bg-primary"></div></div>
      <div class="flex flex-wrap gap-3"><button id="project" class="min-h-11 rounded-lg bg-primary px-4 py-3 text-primary-foreground hover:opacity-80">Open project</button><button id="archive" class="min-h-11 rounded-lg border border-border px-4 py-3 hover:bg-muted">Archive</button></div>
    </section>
    <section class="rounded-xl border border-border bg-card p-6">
      <h2 class="font-semibold">Activity</h2><div class="flex items-center gap-3 mt-6"><span class="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">JD</span><div>Jamie updated the palette<div class="text-muted-foreground mt-2">Just now</div></div></div>
      <div class="mt-6 rounded-lg bg-muted text-muted-foreground p-3" id="status" role="status">All changes saved</div>
    </section>
    <section class="rounded-xl border border-border bg-card p-6">
      <h2 id="settings-heading" class="font-semibold">Project settings</h2>
      <form id="project-settings" aria-labelledby="settings-heading" novalidate>
        <label class="block mt-6 mb-3" for="project-name">Name</label>
        <input id="project-name" name="project-name" required value="Website refresh" class="w-full rounded-lg border border-border bg-background p-3 text-foreground text-base focus:outline-primary aria-invalid:border-destructive"/>
        <p id="project-name-error" role="alert" class="mt-3 text-destructive" hidden></p>
        <label class="flex min-h-11 items-center gap-3 my-6"><input type="checkbox" checked class="accent-primary"/> Email notifications</label>
        <div class="grid gap-3 mb-6"><p id="notification-address" class="break-all text-muted-foreground">jamie@example.com</p><div><button id="edit-email" type="button" class="min-h-11 rounded-lg border border-border bg-background px-4 py-3 text-foreground hover:bg-muted">Edit notification email</button></div></div>
        <button id="save" type="submit" class="min-h-11 rounded-lg bg-primary px-4 py-3 text-primary-foreground">Save changes</button>
      </form>
    </section>
    <section class="rounded-xl border border-border bg-card p-6">
      <h2 class="font-semibold">Team members</h2><div class="flex justify-between gap-3 py-6 border-b border-border"><span>Jamie Davis</span><span class="text-muted-foreground">Owner</span></div><div id="member-row" class="flex justify-between gap-3 py-6"><span>Alex Chen</span><span class="text-muted-foreground">Editor</span></div>
      <button id="remove" data-removed="false" class="min-h-11 rounded-lg border border-border bg-destructive px-4 py-3 text-destructive-foreground data-[removed=true]:bg-background data-[removed=true]:text-foreground">Remove member</button>
    </section>
  </div>
  <dialog id="email-dialog" aria-labelledby="email-heading" aria-describedby="email-description" class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-6 text-foreground backdrop:bg-black/60">
    <form id="email-form" novalidate class="grid gap-6">
      <div class="grid gap-3"><h2 id="email-heading" class="font-semibold">Notification email</h2><p id="email-description" class="text-muted-foreground">Project notifications will be sent to this address.</p></div>
      <div class="grid gap-3"><label for="notification-email">Email address</label><input id="notification-email" name="notification-email" type="email" required autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" autofocus class="min-h-11 w-full rounded-lg border border-border bg-background p-3 text-base text-foreground focus:outline-primary aria-invalid:border-destructive"/><p id="notification-email-error" role="alert" class="text-destructive" hidden></p></div>
      <div class="flex flex-wrap justify-end gap-3"><button id="cancel-email" type="button" class="min-h-11 rounded-lg border border-border bg-background px-4 py-3 text-foreground hover:bg-muted">Cancel</button><button type="submit" class="min-h-11 rounded-lg bg-primary px-4 py-3 text-primary-foreground">Save email</button></div>
    </form>
  </dialog>
  <dialog id="remove-dialog" role="alertdialog" aria-labelledby="remove-heading" aria-describedby="remove-description" class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-6 text-foreground backdrop:bg-black/60">
    <div class="grid gap-6"><div class="grid gap-3"><h2 id="remove-heading" class="font-semibold">Remove Alex Chen?</h2><p id="remove-description" class="text-muted-foreground">Alex Chen will lose access to this project. You can restore access afterward.</p></div>
      <div class="flex flex-wrap justify-end gap-3"><button id="cancel-remove" type="button" autofocus class="min-h-11 rounded-lg border border-border bg-background px-4 py-3 text-foreground hover:bg-muted">Cancel</button><button id="confirm-remove" type="button" class="min-h-11 rounded-lg bg-destructive px-4 py-3 text-destructive-foreground">Remove member</button></div>
    </div>
  </dialog>
</main>`;

export const demoScript = String.raw`(() => {
  // Keep Tab inside the preview dialog, including when Chromium would leave the iframe.
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('input:not([disabled]),button:not([disabled])'), ...(dialog.querySelector('#preview-a11y-overlay')?.shadowRoot?.querySelectorAll('button') ?? [])];
    const focused = dialog.querySelector('#preview-a11y-overlay')?.shadowRoot?.activeElement ?? document.activeElement;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && focused === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && focused === last) { event.preventDefault(); first.focus(); }
  });
  function showModal(dialog) {
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
  }
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => {
    document.documentElement.style.removeProperty('overflow');
  });
  const status = document.getElementById('status');
  const name = document.getElementById('project-name');
  function errorFor(input, message, id) {
    const error = document.getElementById(id);
    error.textContent = message || '';
    error.hidden = !message;
    input.setAttribute('aria-invalid', String(!!message));
    if (message) input.setAttribute('aria-describedby', id);
    else input.removeAttribute('aria-describedby');
    return !message;
  }
  const validateName = () => errorFor(name, name.value.trim() ? null : 'Enter a project name.', 'project-name-error');
  name.addEventListener('input', () => { if (name.getAttribute('aria-invalid') === 'true') validateName(); });
  document.getElementById('project-settings').addEventListener('submit', event => {
    event.preventDefault();
    if (!validateName()) { name.focus(); return; }
    name.value = name.value.trim();
    document.getElementById('project-heading').textContent = name.value;
    status.textContent = 'Settings saved';
  });
  document.getElementById('project').onclick = () => { status.textContent = 'Project opened'; };
  document.getElementById('archive').onclick = () => { status.textContent = 'Project archived'; };
  let email = 'jamie@example.com';
  const emailDialog = document.getElementById('email-dialog');
  const emailInput = document.getElementById('notification-email');
  const emailTrigger = document.getElementById('edit-email');
  const validateEmail = () => errorFor(emailInput, !emailInput.value.trim() ? 'Enter an email address.' : !emailInput.value.includes('@') ? 'Include an @ sign in the email address.' : emailInput.validity.typeMismatch ? 'Enter a valid email address, such as name@example.com.' : null, 'notification-email-error');
  emailTrigger.onclick = () => {
    emailInput.value = email;
    errorFor(emailInput, null, 'notification-email-error');
    showModal(emailDialog);
  };
  emailInput.addEventListener('input', () => { if (emailInput.getAttribute('aria-invalid') === 'true') validateEmail(); });
  emailInput.addEventListener('blur', validateEmail);
  document.getElementById('cancel-email').onclick = () => emailDialog.close();
  emailDialog.addEventListener('close', () => emailTrigger.focus({ preventScroll: true }));
  document.getElementById('email-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!validateEmail()) { emailInput.focus(); return; }
    email = emailInput.value.trim();
    document.getElementById('notification-address').textContent = email;
    emailDialog.close();
    status.textContent = 'Notification email saved';
  });
  const removeDialog = document.getElementById('remove-dialog');
  const remove = document.getElementById('remove');
  const member = document.getElementById('member-row');
  remove.onclick = () => {
    if (member.hidden) {
      member.hidden = false;
      remove.dataset.removed = 'false';
      remove.textContent = 'Remove member';
      status.textContent = 'Member restored';
    } else showModal(removeDialog);
  };
  document.getElementById('cancel-remove').onclick = () => removeDialog.close();
  removeDialog.addEventListener('close', () => remove.focus({ preventScroll: true }));
  document.getElementById('confirm-remove').onclick = () => {
    member.hidden = true;
    remove.dataset.removed = 'true';
    remove.textContent = 'Restore member';
    removeDialog.close();
    status.textContent = 'Member removed';
  };
})();`;

export function demoDocument(
  css: string,
  externalStylesheet = false,
  dark = false,
  options: { script?: string; scripts?: string[] } = {},
) {
  const styles = externalStylesheet
    ? '<link rel="stylesheet" href="./styles.css">'
    : `<style id="preview-theme">${css.replace(/<\/style/gi, "<\\/style")}</style>`;
  const liveScript = options.script ? `;${options.script}` : "";
  return `<!doctype html><html lang="en" class="${dark ? "dark" : ""}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>shadcn/ui ${dark ? "dark" : "light"} preview</title>${styles}</head><body>${demoBody}${(options.scripts ?? []).map((url) => `<script defer src="${url}"></script>`).join("")}<script>${demoScript}${liveScript}</script></body></html>`;
}
export const candidates = [
  ...new Set(
    demoBody
      .match(/class="([^"]+)"/g)
      ?.flatMap((value) => value.slice(7, -1).split(/\s+/)),
  ),
];
export const baseTokens: Record<string, string> = {
  background: "oklch(0.985 0.002 180)",
  foreground: "oklch(0.21 0.018 180)",
  card: "oklch(1 0 0)",
  "card-foreground": "oklch(0.21 0.018 180)",
  primary: "oklch(0.65 0.16 165)",
  "primary-foreground": "oklch(0.16 0.03 165)",
  secondary: "oklch(0.93 0.03 165)",
  "secondary-foreground": "oklch(0.3 0.05 165)",
  muted: "oklch(0.95 0.008 180)",
  "muted-foreground": "oklch(0.49 0.025 180)",
  accent: "oklch(0.9 0.08 165)",
  "accent-foreground": "oklch(0.25 0.05 165)",
  destructive: "oklch(0.55 0.2 25)",
  "destructive-foreground": "oklch(1 0 0)",
  border: "oklch(0.88 0.012 180)",
};
const darkTokens: Record<string, string> = {
  background: "oklch(0.18 0.008 260)",
  foreground: "oklch(0.94 0.005 260)",
  card: "oklch(0.23 0.008 260)",
  "card-foreground": "oklch(0.94 0.005 260)",
  secondary: "oklch(0.3 0.012 260)",
  "secondary-foreground": "oklch(0.94 0.005 260)",
  muted: "oklch(0.28 0.008 260)",
  "muted-foreground": "oklch(0.73 0.008 260)",
  accent: "oklch(0.34 0.035 165)",
  "accent-foreground": "oklch(0.94 0.02 165)",
  border: "oklch(0.38 0.008 260)",
};
const declarations = (tokens: Record<string, string>) =>
  Object.entries(tokens)
    .map(([key, value]) => `  --color-${key}: ${value};`)
    .join("\n");
export const sourceFor = (tokens: Record<string, string>, extra: string) => {
  const source = `@import "tailwindcss";\n\n@theme {\n${declarations(tokens)}\n}\n\n${extra}`;
  return /\.dark\b/.test(source)
    ? source
    : `${source}\n\n:root { color-scheme: light; }\n.dark {\n  color-scheme: dark;\n${declarations(darkTokens)}\n}\n`;
};
export type Preset = {
  id: string;
  name: string;
  tokens: Record<string, string>;
  extra: string;
};
export const presets: Preset[] = [
  {
    id: "mint",
    name: "Mint studio",
    tokens: baseTokens,
    extra: "@theme {\n  --radius-lg: 0.5rem;\n  --radius-xl: 0.75rem;\n}",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    tokens: {
      ...baseTokens,
      primary: "oklch(0.55 0.24 265)",
      "primary-foreground": "oklch(1 0 0)",
      accent: "oklch(0.9 0.05 265)",
    },
    extra: "",
  },
  {
    id: "brutalist",
    name: "Brutalist",
    tokens: {
      ...baseTokens,
      background: "oklch(0.96 0.065 100)",
      foreground: "oklch(0.18 0.015 280)",
      card: "oklch(0.99 0.015 100)",
      "card-foreground": "oklch(0.18 0.015 280)",
      primary: "oklch(0.88 0.23 128)",
      "primary-foreground": "oklch(0.18 0.015 280)",
      secondary: "oklch(0.8 0.13 280)",
      "secondary-foreground": "oklch(0.18 0.015 280)",
      accent: "oklch(0.78 0.18 340)",
      "accent-foreground": "oklch(0.18 0.015 280)",
      muted: "oklch(0.91 0.06 100)",
      "muted-foreground": "oklch(0.4 0.025 280)",
      destructive: "oklch(0.7 0.2 35)",
      "destructive-foreground": "oklch(0.18 0.015 280)",
      border: "oklch(0.18 0.015 280)",
    },
    extra: `@theme {
  --radius-lg: 0;
  --radius-xl: 0;
}
:root { color-scheme: light; }
.dark {
  color-scheme: dark;
  --color-background: oklch(0.2 0.015 280);
  --color-foreground: oklch(0.96 0.025 100);
  --color-card: oklch(0.26 0.015 280);
  --color-card-foreground: oklch(0.96 0.025 100);
  --color-border: oklch(0.88 0.12 100);
  --color-secondary: oklch(0.72 0.15 280);
  --color-secondary-foreground: oklch(0.18 0.015 280);
  --color-muted: oklch(0.32 0.025 280);
  --color-muted-foreground: oklch(0.82 0.03 280);
}
main { font-family: ui-monospace, monospace; }
main :is(section, button, input, .rounded-full) { border-radius: 0; }
main section { border: 2px solid var(--color-border); box-shadow: 5px 5px 0 var(--color-border); }
main :is(button, input:not([type="checkbox"])) { border: 2px solid var(--color-border); }
main button { font-weight: 700; box-shadow: 3px 3px 0 var(--color-border); }
main button:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--color-border); }`,
  },
];
