# Sharing and storage

This is the product contract for URL handling and persistence. Keep the UI, schemas, server, and tests consistent with it.

## Two kinds of links

| Link                                | Contents                                       | How it is created                     |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------- |
| `/#color=L,C,H,A&pickers=HSL,OKHCL` | Current color or palette and open picker modes | The address bar updates while editing |
| `/share/<id>`                       | A preset name and its current stylesheet       | Share preset in the Presets panel     |

Color URLs use lightness, chroma, hue in degrees, and alpha from 0 to 1. Values are bounded before use. `color` is the active picker color; `pickers` lists the open picker modes.

`palette=1` restores palette mode. `start`, `end`, and optional `middle` carry its control colors. `point` selects the active control, `steps` is the subdivision count, `interpolation` chooses the color space, `mode` chooses `apca` or `contrast`, and `chroma` is the saturation multiplier. Optional `positions` contains URL-encoded JSON with light/dark token position overrides. Without `palette=1`, a color link opens single-color mode. Invalid palette data is discarded. Reload and browser navigation restore the URL state.

These address-bar links do not include preset names or stylesheets and do not write to the backend.

Preset links include the editable stylesheet as it stands when Share preset is clicked. This includes unsaved changes, light and dark tokens, generated colors, radii, and other custom CSS. Sharing does not save over a preset or change its dirty state.

Preset links do not include the current picker color, picker layout, selected token, palette endpoints or middle control, generator controls, preview width or tab, or other saved presets. The Share preset button, resulting link, copy status, and errors belong in the Presets panel. A result is hidden when the preset name, stylesheet, or selected preset changes. Changing picker layout alone does not invalidate it.

## Browser storage

The browser saves the workspace under `oklch-workspace` and saved presets under `oklch-presets`. This includes drafts, selected preset and token, picker configuration, palette settings, preview width, and tab. Ordinary editing, saving, discarding, and color URL navigation do not write to the backend.

Undo and redo history stays in memory until reload. It is excluded from browser storage, color URLs, and preset links. Restoring a saved preset through undo or redo updates the ordinary browser storage.

Opening a preset link imports its name and stylesheet as a local preset and selects it. An identical local preset is reused. Existing saved presets are never overwritten by an import. The recipient keeps their current color, picker configuration, palette, preview width, and tab. The selected token is cleared to avoid binding it to an unrelated declaration.

After import, the address becomes the normal color URL. The imported preset remains in browser storage. Use Share preset to create another preset link; copying the address shares the current color or palette.

## Share storage and API

Only explicit preset sharing writes to SQLite. Share records are immutable and use random 16-character IDs. The database is not an account, browser backup, draft store, or autosave service.

`POST /api/shares` accepts this payload and returns `{ "id": "..." }`:

```json
{
  "version": 2,
  "preset": {
    "name": "My theme",
    "source": "@import \"tailwindcss\"; @theme { --color-primary: oklch(0.6 0.2 30); }"
  }
}
```

`GET /api/shares/:id` returns the preset payload. Names are limited to 200 characters and stylesheets to 500,000 characters. The request body limit is 1 MiB. Shared data is validated on the server and client. Extra workspace fields are stripped before a new record is stored.

The SQLite file comes from `SHARE_DB_PATH`, with `.data/shares.sqlite` as the development default and `/data/shares.sqlite` in production. The `shares.snapshot` column stores each validated preset payload.

## Unsupported data

This is a single-user app. Unsupported share records are deleted, not converted. There are no readers for old workspace share payloads, compressed `#s=` links, or bare color hashes. Obsolete URL fragments are replaced by the normal color URL. Keep this policy simple; do not add migration layers.
