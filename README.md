# Open Handball Tactics

A local-first handball tactics workspace in the [Open Handball](https://github.com/estevE11/open-handball-video) ecosystem. Plan drills, arrange players, draw trajectories, and keep a reusable library entirely in your browser.

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

- **Live collaboration:** choose **Share → Create live room**, copy the link, and send it to other coaches. Everyone can edit; names, live court cursors, player/arrow drags, ink and erasing previews appear as they happen. Drill contents (including uploaded images, kits, steps and coaching notes), court settings, workspace defaults, theme, drawing settings, Voronoi, onion skin, active step/pane, and playback controls are shared. Tools and object selection stay personal so people can work independently. A room starts with a copy of your drill; leaving keeps a local copy. Opening another drill leaves the room.
- React 19, TypeScript, Vite, Tailwind CSS, Lucide, and Zustand, following Open Handball Video's `components/app`, `components/ui`, `lib`, `hooks`, `store`, and `types` separation.
- Native SVG tactical engine with pointer capture, scalable court coordinates, drag positioning, and editable quadratic Bézier trajectories. SVG keeps the foundation lightweight and supports self-contained vector export without an additional rendering framework.
- Horizontal full court (40 × 20 m), half court with the goal at the top (attacking view) or bottom (defending view), a compact 20 × 16 m half-court option, and configurable rectangular practice areas. Floor/goal-area/line colors, canvas background (custom or matching the floor), line weights, grid, player labels, and boundary highlights are editable. Courts include goal areas, dashed 9 m lines, 7 m marks, 4 m goalkeeper marks, and substitution marks.
- Defenders and goalkeepers are triangles pointing toward the attack by default. Defenders use `1`, `2`, `3`, and `Av`; circle attackers use `A`–`F`. Select an object to rotate it using the round handle or angle input; hold Shift for 15° snapping. Player labels scale with their chips and follow manual rotation while flipping to avoid upside-down text. Default labels stay upright in either half-court view and on the horizontal full court. Triangle labels sit toward the base for visual centering. This applies to animation, onion skins, and snapshots. Player label, shape, size, and color remain editable.
- Workspace defaults store every court setting and a 50–200% player scale. New drills copy those defaults; existing drills keep independent overrides. **Apply workspace defaults** restores the defaults to the current drill with undo support. Scaling includes attackers, defenders, and goalkeepers and leaves equipment unchanged.
- **Player kits:** open the attacker or defender kit menu for named previews, 17 basic designs, and your saved kits. Create or customize solid colors, 1–3 vertical/horizontal/diagonal stripes (including reverse diagonal), and two-color halves. The editor previews circles and triangles and lets you set both colors and label color. **Save and apply** stores the kit locally and dresses that team across every step, new player, and formation in the current drill; **Use player colors** restores individual colors. Editing a shared kit updates its uses in the current drill; other drills retain their saved copy until reapplied. Kits stay with `.hbd` exports/imports, animation, onion skins, PNG/SVG snapshots, and offline use.
- Select a player and enable **Peto** for a translucent training bib over their chip or kit, beneath the label. Choose yellow, orange, green, or blue. Bibs follow player rotation and scale, copy into new steps, and persist in drills and exports.
- Defense presets: 6:0, 5:1, 3:2:1, 4:2, 3:3. Offense presets: 3:3 and 2:4. Attackers use `F` (left wing), `E` (pivot), `D` (right wing), with `A` (left back), `B` (center back), `C` (right back). In 2:4, `B` advances to a second pivot alongside `E`. Applying a formation replaces only that role's players in the current step.
- Running, passing, dribbling, and screen/block trajectories. Drag the line to move the complete path, or drag its endpoints and numbered Bézier handles. Add/remove up to 12 control points. Choose end-only, start-only, double-ended, or headless paths in the inspector; screen paths use T-bar markers. Select a trajectory and use **Line color** to recolor its path and heads, including while selected; colors are saved with the step and included in exports.
- Balls touching a player travel with it when dragged, preserving their exact offset. Dragging a ball always moves it independently; dropping it against a player makes it ready to carry again. Contact follows chip shape, rotation, and scale, and carried movement supports undo, saved steps, and animation.
- **Voronoi mode:** toggle the hexagon directly left of Undo/Redo to show each player's nearest-player territory, bounded by the court. Regions use each team's primary kit color (or its player color) at 0.3 fill opacity, with borders around every cell. The goalkeeper belongs to the defending team; equipment is ignored. Regions follow live dragging, undo/redo, steps, and animation, and the active overlay is included in PNG/SVG snapshots.
- **Freehand drawing (B):** left-drag to draw corrected, smooth curves; right-click or right-drag to erase entire strokes. Choose color, thickness, opacity, and smoothing in the left panel. Draw across the entire canvas, including outside the court; court edits preserve those strokes and snapshots expand to include them. **Erase whole strokes (E)** also works with touch; **Clear drawing** clears only the current step's drawings. Drawing, erasing, and clearing support undo/redo. Drawings copy into new steps and persist in saved drills, `.hbd` backups, and PNG/SVG snapshots. Native Pointer Events accept mouse, touch, and stylus input, including coalesced pen samples where available and pen barrel/eraser buttons exposed by the browser. **Pen only** ignores fingers/palms. Apple Pencil and OnePlus Stylo 2 should work where their browser exposes pen input; physical-device testing is still needed, and hardware-specific gestures are not mapped.
- Multiple balls, compact striped training cones, mini-goals, eight-rung agility ladders, text, and uploaded image markers. Equipment supports rotation. Click an image or drag it from the asset manager to place it.
- Selection follows the object's silhouette with a small gap, including rotated tokens and equipment. Selection handles and outlines are excluded from exports.
- Nested folders with create, rename, move, duplicate, and recursive delete. Drill create, rename, move, duplicate, delete, tags, notes, and search by title/tag/folder path. The library stays out of the way until opened as an animated drawer over the workspace. Open folder management using its ellipsis; drill management uses the ellipsis beside its title.
- Autosave with visible pending/error states, retry, bounded undo/redo, editable keyframe steps, and previous-step onion skinning. Copy a step, move or rotate the same players, and use Play or the timeline scrubber to preview movement and shortest-arc rotation. Each step's duration controls its transition to the next step; previewing never changes the saved frames.
- The toolbar sits directly beneath the top bar. Pen options use a left panel, keeping the full canvas height; app version and privacy information live in **Help (?)**.
- **Fullscreen court:** use the expand button in the top bar. The court uses the entire viewport and preserves its proportions, filling the height for half courts or the width for full courts when the screen proportions allow. Tools and properties slide over the court independently: left/right for half courts, top/bottom for full courts. Hide panels with their arrows and reopen them from the small edge buttons; the court never resizes or moves. Pen settings are inside Properties in fullscreen. Escape or the exit button restores the workspace. Native fullscreen is used where available, with a viewport-filling fallback when unsupported or denied.
- Saved Light, Dark, and Follow system appearance settings. Dark mode changes the workspace UI while leaving the main canvas and exported images unchanged.
- Portable `.hbd` import/export embeds binary assets and gives imports new identifiers. PNG/SVG snapshots include uploaded images.
- **Animated export:** open Export, choose **GIF animation** or **Video animation**, then download, copy, or share the prepared result without re-encoding. GIFs loop all steps at up to 20 fps with a one-second final pause; very long drills reduce frame rate while preserving timing. Video records in real time as MP4 where supported, with WebM as the fallback. Output uses a 720px longest edge, retains kits, images, rotations, drawings outside the court, and the active Voronoi overlay, and leaves editing/playback unchanged. GIF encoding runs locally in a bundled worker, including offline. Export can be canceled or closed.
- **Copy GIF:** writes native GIF data where the browser supports it; otherwise copies an HTML image containing the animated GIF plus a PNG preview. The receiving app decides whether it pastes animation or a still image. **Copy image** labels the fallback honestly. A downloaded GIF still requires GIF support in the receiving app. For **WhatsApp Web**, use **WhatsApp MP4**: it generates and downloads an H.264 MP4 in one action; attach it using **Photos & videos** to send it as a video. This option is disabled when the browser cannot record H.264 MP4; WebM is never renamed to MP4. Clipboard denial keeps the download ready.
- Installable PWA with bundled icons and a precached application shell. New versions prompt for an update after pending saves complete.

**Planned:** Multi-thumbnail PDF drill sheets.

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
    drawingGeometry.ts   Freehand smoothing and whole-stroke eraser geometry
    preferences.ts       Validated browser-local court defaults and theme
    projectCompatibility.ts  Additive compatibility for older saved drills
    formations.ts        Handball-specific formation coordinates and labels
    projectDefaults.ts   Serializable project construction
    projectIo.ts         Validated .hbd import/export with embedded images
    snapshot.ts          Shared SVG serialization and PNG/SVG snapshot export
    animationExport.ts   GIF worker encoding and browser-native video recording
    animationRenderer.tsx  Reuses the board renderer without changing editor state
    animationClipboard.ts  Native GIF or HTML/PNG clipboard sharing
  store/projectStore.ts  Editing, history, serialized autosave, save errors
  store/preferencesStore.ts  Workspace defaults and appearance
  types/project.ts       Versioned Zod schemas and inferred TypeScript types
  App.tsx                Workspace and project lifecycle
public/                  Locally bundled application icons
e2e/                     Production browser and offline regression tests
vite.config.ts           Vite + PWA precaching and web app manifest
vercel.json              Static hosting and service-worker cache headers
```

The database is `ohb.library.v1`, database version 3 (project file schema remains version 1). Separate `projects`, `folders`, `kits`, `assets`, and `rooms` tables keep canvas JSON, binary images, and cached collaborative documents independent. Project and folder mutations update both sides of tree membership in one transaction. Folder moves reject cycles; subtree duplication creates independent IDs; subtree deletion removes its drills atomically. `parentId` and `folderId` are authoritative; the service synchronizes the schema's `childrenFolderIds` and `drillIds` lists.

Small workspace preferences use the `ohb.preferences.v1` localStorage key; drill-specific court settings stay in IndexedDB and portable `.hbd` exports. Missing preferences use built-in defaults. Legacy projects without orientation receive forward-facing defenders and triangle goalkeepers when opened; explicit orientations remain intact. Legacy single-control-point arrows remain supported. New orientation, control-point, arrowhead, and scale fields are additive to project schema version 1.

Image blobs belong to the reusable asset library. Deleting a drill retains its images so other drills and duplicates remain valid. Explicit asset deletion is blocked while any drill references that asset. Runtime `blob:` URLs are revoked when their owning subscription changes or unmounts; persisted references use `asset:<id>`. Images are limited to 10 MiB and PNG, JPEG, WebP, or GIF. Imports validate the full model, embedded asset references, and format version before an atomic transaction.

Autosave writes are serialized. Drag previews stay in component state and are broadcast as ephemeral presence in live rooms; pointer release commits the edit. Failed writes preserve the in-memory project, show an error, and allow retry or `.hbd` export. Pending/failed saves trigger the browser's leave-page protection. Use live room links when editing together; ordinary local drills do not synchronize between tabs.

## Peer-to-peer rooms

Rooms use [Trystero's MQTT strategy](https://trystero.dev/docs/signaling-strategies/) for WebRTC discovery through independent public brokers and [Yjs](https://github.com/yjs/yjs) for conflict-safe state. No application backend, relay deployment, credentials, account, or environment variables are required. Discovery services carry encrypted connection setup; drill updates, images, and presence travel directly over encrypted WebRTC data channels. Boards are not sent through the brokers. The unguessable room ID and secret live in the URL fragment, which is not sent to the static hosting server. Anyone with the complete link has editing access.

The room button shows **Room · 1** while waiting and **Live** once someone connects. If joining stalls, the app reports whether discovery services are reachable and provides **Retry connection**, which preserves the link and cached shared work. Connection failures distinguish a bad link from browsers that found each other but cannot establish direct P2P. Both browsers must accept the latest app update; older versions using Nostr discovery cannot discover MQTT rooms. The update notice remains accessible while joining.

Fields and entities merge independently, preserving simultaneous moves of different players and concurrent additions. Concurrent changes to the same field resolve deterministically. Deleting an entity takes precedence over concurrent field edits. Ordered point arrays and tags are atomic values. Room undo/redo tracks your own changes and retains other coaches' edits. Playback runs on each browser's animation clock after shared commands; synchronization is approximate rather than frame-locked.

Keep at least one participant online for a new browser to receive the drill. Each browser caches the room document and its received images in IndexedDB, so an existing participant can reopen the same link after everyone disconnects and make the room available again. A link alone cannot recover a room after all participant copies have been cleared. Local libraries, folders, unused assets, saved kit libraries, fullscreen and panel visibility are personal. Shared workspace defaults and theme apply for the room session; personal stored preferences remain available after a reload outside the room.

Public discovery services and STUN are external dependencies with no uptime guarantee. Peers can be in different countries; distance does not require a different sharing flow. Restrictive NATs, VPNs, firewalls, Wi-Fi client isolation and school/club networks may prevent direct WebRTC connections. No TURN relay is configured, so connectivity across every network is not guaranteed. A managed TURN fallback is optional and would require a provider account, not a server to maintain. Rooms are intended for small coaching groups using a peer mesh. Browser tests exercise actual WebRTC between isolated profiles with a deterministic discovery broker; the opt-in public test uses separate browser processes, clock skew, and an unavailable primary broker.

To check the public services from your current network after building, run `PUBLIC_DISCOVERY=1 npm run test:e2e -- e2e/collaboration.spec.ts -g "public discovery"`.

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
