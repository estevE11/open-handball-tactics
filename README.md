# Open Handball Board

A local-first handball tactics board in the [Open Handball](https://github.com/estevE11/open-handball-video) ecosystem. Plan drills, arrange players, draw trajectories, and keep a reusable library entirely in your browser.

**Web app:** https://open-handball-tactics.vercel.app

## Development

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run dev       # http://localhost:5173
npm run lint
npm test          # IndexedDB integrity and portable project tests
npm run build     # TypeScript check, production build, manifest, service worker
npm run preview   # Production build, including offline support
npm run test:e2e  # Production browser tests; Google Chrome locally
```

For environments without Chrome, run `npx playwright install chromium` and `CI=1 npm run test:e2e`. Build before running browser tests. CI installs Chromium and verifies lint, unit tests, the production build, and browser workflows.

## Features · v0.2

- React 19, TypeScript, Vite, Tailwind CSS, Lucide, and Zustand, following Open Handball Video's `components/app`, `components/ui`, `lib`, `hooks`, `store`, and `types` separation.
- Native SVG tactical engine with pointer capture, scalable court coordinates, drag positioning, and editable quadratic Bézier trajectories. SVG keeps the foundation lightweight and supports self-contained vector export without an additional rendering framework.
- Horizontal full court (40 × 20 m), half court with the goal at the top (attacking view) or bottom (defending view), and configurable rectangular practice areas. Floor/goal-area/line colors, line weights, grid, player labels, and boundary highlights are editable. Courts include goal areas, dashed 9 m lines, 7 m marks, 4 m goalkeeper marks, and substitution marks.
- Defenders and goalkeepers are triangles pointing toward the attack by default. Defenders use `1`, `2`, `3`, and `Av`; circle attackers use `A`–`F`. Select an object to rotate it using the round handle or angle input; hold Shift for 15° snapping. Player labels scale with their chips and follow manual rotation while flipping to avoid upside-down text. Default labels stay upright in either half-court view and on the horizontal full court. Triangle labels sit toward the base for visual centering. This applies to animation, onion skins, and snapshots. Player label, shape, size, and color remain editable.
- Workspace defaults store every court setting and a 50–200% player scale. New drills copy those defaults; existing drills keep independent overrides. **Apply workspace defaults** restores the defaults to the current drill with undo support. Scaling includes attackers, defenders, and goalkeepers and leaves equipment unchanged.
- **Player kits:** open the attacker or defender kit menu for named previews, 17 basic designs, and your saved kits. Create or customize solid colors, 1–3 vertical/horizontal/diagonal stripes (including reverse diagonal), and two-color halves. The editor previews circles and triangles and lets you set both colors and label color. **Save and apply** stores the kit locally and dresses that team across every step, new player, and formation in the current drill; **Use player colors** restores individual colors. Editing a shared kit updates its uses in the current drill; other drills retain their saved copy until reapplied. Kits stay with `.hbd` exports/imports, animation, onion skins, PNG/SVG snapshots, and offline use.
- Select a player and enable **Peto** for a translucent training bib over their chip or kit, beneath the label. Choose yellow, orange, green, or blue. Bibs follow player rotation and scale, copy into new steps, and persist in drills and exports.
- Defense presets: 6:0, 5:1, 3:2:1, 4:2, 3:3. Offense presets: 3:3 and 2:4. Attackers use `F` (left wing), `E` (pivot), `D` (right wing), with `A` (left back), `B` (center back), `C` (right back). In 2:4, `B` advances to a second pivot alongside `E`. Applying a formation replaces only that role's players in the current step.
- Running, passing, dribbling, and screen/block trajectories. Drag the line to move the complete path, or drag its endpoints and numbered Bézier handles. Add/remove up to 12 control points. Choose end-only, start-only, double-ended, or headless paths in the inspector; screen paths use T-bar markers. Select a trajectory and use **Line color** to recolor its path and heads, including while selected; colors are saved with the step and included in exports.
- Balls touching a player travel with it when dragged, preserving their exact offset. Dragging a ball always moves it independently; dropping it against a player makes it ready to carry again. Contact follows chip shape, rotation, and scale, and carried movement supports undo, saved steps, and animation.
- Multiple balls, compact striped training cones, mini-goals, eight-rung agility ladders, text, and uploaded image markers. Equipment supports rotation. Click an image or drag it from the asset manager to place it.
- Selection follows the object's silhouette with a small gap, including rotated tokens and equipment. Selection handles and outlines are excluded from exports.
- Nested folders with create, rename, move, duplicate, and recursive delete. Drill create, rename, move, duplicate, delete, tags, notes, and search by title/tag/folder path. Open folder management using its ellipsis; drill management uses the ellipsis beside its title.
- Autosave with visible pending/error states, retry, bounded undo/redo, editable keyframe steps, and previous-step onion skinning. Copy a step, move or rotate the same players, and use Play or the timeline scrubber to preview movement and shortest-arc rotation. Each step's duration controls its transition to the next step; previewing never changes the saved frames.
- Saved Light, Dark, and Follow system appearance settings. Dark mode changes the workspace UI while leaving the main canvas and exported images unchanged.
- Portable `.hbd` import/export embeds binary assets and gives imports new identifiers. PNG/SVG snapshots include uploaded images.
- Installable PWA with bundled icons and a precached application shell. New versions prompt for an update after pending saves complete.

**Planned:** WebM/GIF animation export and multi-thumbnail PDF drill sheets.

## Architecture

```text
src/
  components/
    app/                 Inspector, shared court settings, theme, playback controls
    board/               Court geometry, tokens, arrows, pointer interactions
    library/             Recursive folder tree
    ui/                  Accessible native dialog
  hooks/useAssetUrls.ts   Blob URL ownership and cleanup
  lib/
    browserStorage.ts    Dexie schema and transactional library service
    animation.ts         Position, rotation, and path interpolation
    arrowGeometry.ts     Path translation and multi-bend Bézier geometry
    preferences.ts       Validated browser-local court defaults and theme
    projectCompatibility.ts  Additive compatibility for older saved drills
    formations.ts        Handball-specific formation coordinates and labels
    projectDefaults.ts   Serializable project construction
    projectIo.ts         Validated .hbd import/export with embedded images
    snapshot.ts          PNG and SVG snapshot export
  store/projectStore.ts  Editing, history, serialized autosave, save errors
  store/preferencesStore.ts  Workspace defaults and appearance
  types/project.ts       Versioned Zod schemas and inferred TypeScript types
  App.tsx                Workspace and project lifecycle
public/                  Locally bundled application icons
e2e/                     Production browser and offline regression tests
vite.config.ts           Vite + PWA precaching and web app manifest
vercel.json              Static hosting and service-worker cache headers
```

The database is `ohb.library.v1`, schema version 1. Separate `projects`, `folders`, and `assets` tables keep canvas JSON independent of binary images. Project and folder mutations update both sides of tree membership in one transaction. Folder moves reject cycles; subtree duplication creates independent IDs; subtree deletion removes its drills atomically. `parentId` and `folderId` are authoritative; the service synchronizes the schema's `childrenFolderIds` and `drillIds` lists.

Small workspace preferences use the `ohb.preferences.v1` localStorage key; drill-specific court settings stay in IndexedDB and portable `.hbd` exports. Missing preferences use built-in defaults. Legacy projects without orientation receive forward-facing defenders and triangle goalkeepers when opened; explicit orientations remain intact. Legacy single-control-point arrows remain supported. New orientation, control-point, arrowhead, and scale fields are additive to project schema version 1.

Image blobs belong to the reusable asset library. Deleting a drill retains its images so other drills and duplicates remain valid. Explicit asset deletion is blocked while any drill references that asset. Runtime `blob:` URLs are revoked when their owning subscription changes or unmounts; persisted references use `asset:<id>`. Images are limited to 10 MiB and PNG, JPEG, WebP, or GIF. Imports validate the full model, embedded asset references, and format version before an atomic transaction.

Autosave writes are serialized. Drag previews stay in component state; pointer release creates one history entry and one save. Failed writes preserve the in-memory project, show an error, and allow retry or `.hbd` export. Pending/failed saves trigger the browser's leave-page protection. Use one editing tab per drill; collaborative conflict resolution is not implemented.

## Offline and data ownership

No accounts, backend database, remote image service, external fonts, or analytics. Vercel serves static application files only. Open the app online once and wait for **Ready offline** before disconnecting. Offline support runs in the production build on localhost or HTTPS, not the Vite development server.

Browser storage belongs to the current origin, browser profile, and device. Clearing site data removes the library; another deployment hostname has a separate library. Use the stable production URL and export `.hbd` backups. **Help → Request persistent storage** asks the browser to reduce automatic eviction; browsers may decline. Private browsing storage is temporary.

## Deployment

```sh
vercel link
vercel deploy --prod --yes
```

The GitHub repository is connected to Vercel for subsequent deploys. No runtime secrets or environment variables are required. The service worker uses `Cache-Control: no-cache`; content-hashed application files are precached for offline use.

Implementation references: [Dexie transactions](https://dexie.org/docs/Dexie/Dexie.transaction%28%29), [Vite PWA registration](https://vite-pwa-org.netlify.app/guide/register-service-worker), and the local Open Handball Video project.

## License

MIT.
