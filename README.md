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

## Step 1 delivery

- React 19, TypeScript, Vite, Tailwind CSS, Lucide, and Zustand, following Open Handball Video's `components/app`, `components/ui`, `lib`, `hooks`, `store`, and `types` separation.
- Native SVG tactical engine with pointer capture, scalable court coordinates, drag positioning, and editable quadratic Bézier trajectories. SVG keeps the foundation lightweight and supports self-contained vector export without an additional rendering framework.
- Full court (40 × 20 m), half court, and configurable rectangular practice areas. Floor/goal-area/line colors, line weights, grid, player labels, and boundary highlights are editable. Courts include goal areas, dashed 9 m lines, 7 m marks, 4 m goalkeeper marks, and substitution marks.
- Triangle defenders with `1`, `2`, `3`, and `Av`; circle attackers with `A`–`F`; distinct goalkeeper. Player label, shape, size, and color are editable. Custom positional abbreviations and names can be entered as labels.
- Defense presets: 6:0, 5:1, 3:2:1, 4:2, 3:3. Offense presets: 3:3 and 2:4. Applying a formation replaces only that role's players in the current step.
- Running, passing, dribbling, and screen/block trajectories; drag the control handle of a selected trajectory to curve it.
- Multiple balls, cones, mini-goals, agility ladders, text, and uploaded image markers. Click an image or drag it from the asset manager to place it.
- Nested folders with create, rename, move, duplicate, and recursive delete. Drill create, rename, move, duplicate, delete, tags, notes, and search by title/tag/folder path. Open folder management using its ellipsis; drill management uses the ellipsis beside its title.
- Autosave with visible pending/error states, retry, bounded undo/redo, editable keyframe steps, and previous-step onion skinning.
- Portable `.hbd` import/export embeds binary assets and gives imports new identifiers. PNG/SVG snapshots include uploaded images.
- Installable PWA with bundled icons and a precached application shell. New versions prompt for an update after pending saves complete.

**Next phase:** animation playback/interpolation and timeline scrubbing, WebM/GIF export, and multi-thumbnail PDF drill sheets. These are not part of this Step 1 delivery. Steps currently store positions and trajectories without animating between them.

## Architecture

```text
src/
  components/
    app/                 Toolbar and board inspector
    board/               Court geometry, tokens, arrows, pointer interactions
    library/             Recursive folder tree
    ui/                  Accessible native dialog
  hooks/useAssetUrls.ts   Blob URL ownership and cleanup
  lib/
    browserStorage.ts    Dexie schema and transactional library service
    formations.ts        Handball-specific formation coordinates and labels
    projectDefaults.ts   Serializable project construction
    projectIo.ts         Validated .hbd import/export with embedded images
    snapshot.ts          PNG and SVG snapshot export
  store/projectStore.ts  Editing, history, serialized autosave, save errors
  types/project.ts       Versioned Zod schemas and inferred TypeScript types
  App.tsx                Workspace and project lifecycle
public/                  Locally bundled application icons
e2e/                     Production browser and offline regression tests
vite.config.ts           Vite + PWA precaching and web app manifest
vercel.json              Static hosting and service-worker cache headers
```

The database is `ohb.library.v1`, schema version 1. Separate `projects`, `folders`, and `assets` tables keep canvas JSON independent of binary images. Project and folder mutations update both sides of tree membership in one transaction. Folder moves reject cycles; subtree duplication creates independent IDs; subtree deletion removes its drills atomically. `parentId` and `folderId` are authoritative; the service synchronizes the schema's `childrenFolderIds` and `drillIds` lists.

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
