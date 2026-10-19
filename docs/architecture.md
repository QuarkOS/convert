# Convert plan

Convert turns a file the user already has into another type an app will accept. Emilio's path is a right-click menu named Convert to. The shared core decides which targets are valid, and it chains a conversion when no single engine covers the pair. Three pull requests land in order. `convert-core` is the library. `convert-extension` and `convert-windows` are the two menus, and both start from `convert-core`.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. The operator lands the stack. This session does not merge. Push access to `quark/convert` returned HTTP 403, so a separate VM opens the pull requests from the git bundle once access works.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on the operator's explicit go.
- [ ] Read these from trunk at program start. Re-read them at every tick.
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md`
  - [ ] `git show origin/main:pstack/skills/swarm/SKILL.md`
  - [ ] `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md`
  - [ ] `git show origin/main:pstack/skills/technical-writing/SKILL.md`
- [ ] On the operator's go, arm the audit tick as `/loop 1h` with the tick prompt below. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk. Audit the operation against it and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then post a short status message to the operator in chat only when the audit found a tracked change that no earlier status message reported, such as a PR opened, a code-ready head, a round launched or closed, a verdict, a merge, a stuck agent and the action taken, a blocker added or cleared, or a decision only the operator can make. Name every such change and nothing else. Do not repeat a table, the merged list, or an unchanged blocker. If the audit found none, end the turn with no reply text. Either way, log this tick's row in your decision trail. The row names the items reported, or none."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle the execution playbook names.
- [ ] Follow this dependency graph. Start dependent work only after its parent merges, or base it on the parent branch when the execution playbook stacks.
  - [ ] `convert-core` is first and branches from `main`.
  - [ ] `convert-extension` and `convert-windows` both branch from `convert-core` after that branch is pushed. They do not edit the same files.
- [ ] Hold the file boundaries. `convert-core` touches `packages/core` and the root docs. `convert-extension` touches `packages/extension` and `fixtures/pages`. `convert-windows` touches `apps/windows`.
- [ ] Hold the review gate. `convert-extension` and `convert-windows` change an interaction. They wait for the operator's review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`. If `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open the PR ready, never draft, per **Opening a PR**. Use the run's built-in PR tool when it has one, else `origin pr create --status open --base <base-branch>` or `gh pr create --base <base-branch>` according to the resolved forge. A stack child targets its parent branch.
- [ ] Run the repo's lint and typecheck once before the PR-facing push. Push with hooks on.
- [ ] Run `/deslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment per `../references/bugbot-triage.md`.
- [ ] Rebase onto current trunk before the code-ready report and babysit. Keep that merge base in fix rounds. Rebase again only at merge prep, on a `git merge-tree` conflict with trunk, or on a CI failure that comes from a change on trunk.

### Verdict and merge, for every PR

- [ ] A full swarm runs once, at the code-ready head. Another full swarm runs only for new behavior, a redesign, or a large new diff. A rebase, a merge-conflict resolution, or a minor fix gets a single verifier at the new head. Run each full swarm per `pstack/skills/swarm/SKILL.md`. One gates lane. The ten live lanes from the PR's **Verify, live** block. The perf lane from its **Verify, perf** block. Two or more audit lanes, each with its own focus, that read the diff and the receipts and distrust the PR body. The root audits the receipts in the merge-ready report before the verdict.
- [ ] Clean only when every lane is `PASS`. Findings go back to the owner, including a defect that a lane filed as a note. A new head gets a fresh verdict, except for results that stay valid under the patch-id rule in `playbooks/shipping.md`.
- [ ] The operator lands the stack. Nobody in this session merges, retargets onto `main`, or force-pushes. The patch-id rule in `playbooks/shipping.md` still applies when the landing VM rebases.

### Boot recipe, for every live lane

Each live lane runs on its own cloud VM at the PR head. `control-ui` from `cursor-team-kit` is not installed here. Browser lanes drive Chromium with Playwright. Windows lanes drive the verify gateway over SSH. Library lanes run the Node test process and save a screenshot of the probe log.

- [ ] `git fetch origin <head-branch> && git checkout <head SHA>`.
- [ ] Install Node 22, run `npm install`, and install `ffmpeg`, `ffprobe`, `pandoc`, and `pdftotext` for core lanes. Extension lanes also launch Chromium. Windows lanes use one `windows@verify.emilioschwaiger.com` session.
- [ ] Deliver input only through the test command, Playwright, or the Windows shell. Read-only diagnostics are `ffprobe`, `pdftotext`, and Python `zipfile`.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.

## Ship the conversion core (convert-core)

**Depends on.** None. Branch `convert-core` from `main`.

**Files.**

- [ ] Edit `README.md`.
- [ ] Create `packages/core`.
- [ ] Create `docs/architecture.md`.

**Build.**

- [ ] `FormatCatalog`, `FormatGraph`, and `ConversionJob` name the domain. Engines are classes with static methods. The graph is the edge list those classes return.

**You see.**

- [ ] `npm test` prints 10 passing tests, and `npm run matrix` lists a target set for every input format.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `packages/core/test/convert.test.ts` converts every offered pair from a real fixture and checks magic bytes, a parser, or `ffprobe`. Run `npm test`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.7-xhigh-fast` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run the matrix command at trunk and at head. Trunk has no converter, so record that and gate the new matrix plus a valid jpeg from the red PNG fixture. Save `core-lane-1.png`. Pass when head prints a png row that includes jpg and trunk has no `FormatGraph`.
- [ ] Lane 2. Convert the red PNG fixture to jpeg and decode the first pixel. Save `core-lane-2.png`. Pass when the pixel is reddish and the file starts with jpeg magic.
- [ ] Lane 3. Convert the SVG fixture to BMP and confirm the path is svg, then png, then bmp. Save `core-lane-3.png`. Pass when `ffprobe` reads a bitmap and the step list is those three formats.
- [ ] Lane 4. Decode the HEIC fixture to PNG. Save `core-lane-4.png`. Pass when the PNG magic matches and the graph has no edge whose target is heic.
- [ ] Lane 5. Convert the markdown fixture to PDF and extract the text with `pdftotext`. Save `core-lane-5.png`. Pass when the text contains ConvertFixture.
- [ ] Lane 6. Convert the same markdown with the bundled engine list, which drops pandoc. Save `core-lane-6.png`. Pass when the docx package contains the phrase in `word/document.xml`.
- [ ] Lane 7. Convert the CSV fixture to xlsx and to ODS. Save `core-lane-7.png`. Pass when both zip packages contain ConvertFixture.
- [ ] Lane 8. Convert a one-object JSON fixture to CSV. Save `core-lane-8.png`. Pass when the result code is not-tabular.
- [ ] Lane 9. Convert the WAV fixture to mp3, flac, ogg, and m4a. Save `core-lane-9.png`. Pass when `ffprobe` reports an audio stream for each file.
- [ ] Lane 10. Convert the MP4 fixture to webm, mov, and gif, then the gif to PNG. Save `core-lane-10.png`. Pass when video outputs have a video stream and the PNG magic matches.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Milliseconds for `ConversionJob` to turn the 32 by 32 PNG fixture into a jpeg. Trunk has no converter, so also time that same head command as the work the diff adds. The end state the user waits for is a jpeg file on disk.
- [ ] Probe. Run the conversion five times at head, interleaved with one trunk attempt that must fail because the command does not exist. Record every sample.
- [ ] Baseline. Trunk has no converter. Record that absence before trusting the head samples. Do not invent a trunk duration.
- [ ] Rule. Head fails when any sample takes 2000 ms or longer. Do not divide head by trunk. A first-run sample of 19 ms on this VM is under that budget. Later samples in the same process were 7, 2, 1, and 0 ms, which is sharp staying warm, not a second scenario.

**Review gate.** None. convert-core is not review-gated.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] The operator lands this pull request. This session does not merge it.

## Ship the browser extension (convert-extension)

**Depends on.** convert-core. Branch `convert-extension` from `convert-core`.

**Files.**

- [ ] Create `packages/extension`.
- [ ] Create `fixtures/pages`.
- [ ] Create `docs/store-listings/extension.md`.

**Build.**

- [ ] A Manifest V3 popup and a content script. The popup lists `FormatGraph` targets. The content script offers a conversion when a chosen file misses the input `accept` list or when the page reports a type error.

**You see.**

- [ ] Chromium loads the unpacked extension. A dropped PNG downloads a jpeg. A fixture page shows the toast and then accepts the replaced file.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `packages/extension/test` covers the accept mismatch and the scripted rejection page. Run `npm test -w @convert/extension`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.7-xhigh-fast` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Trunk has no extension, so record that and gate the unpacked popup plus a downloaded jpeg. Save `ext-lane-1.png`. Pass when the popup shows a target list and the download is a jpeg.
- [ ] Lane 2. Drop the red PNG in the popup and choose jpeg. Save `ext-lane-2.png`. Pass when the browser downloads a file whose magic is jpeg.
- [ ] Lane 3. Open the context menu on an image. Save `ext-lane-3.png`. Pass when the menu contains Convert to and only graph targets.
- [ ] Lane 4. Open the accept fixture and choose a file the input rejects. Save `ext-lane-4.png`. Pass when a toast offers only types the input accepts and the graph allows.
- [ ] Lane 5. Accept the toast and confirm the input's files list changed. Save `ext-lane-5.png`. Pass when the page reads the new file as an accepted type.
- [ ] Lane 6. Open the rejection fixture and choose a file the script rejects. Save `ext-lane-6.png`. Pass when the toast appears next to the input after the alert text.
- [ ] Lane 7. Turn the rescue off for that origin and choose the same bad file. Save `ext-lane-7.png`. Pass when no toast appears.
- [ ] Lane 8. Turn the global switch off in the popup and retry on a second origin. Save `ext-lane-8.png`. Pass when no toast appears.
- [ ] Lane 9. Convert one file on a public upload page using a generated image and no private data. Save `ext-lane-9.png`. Pass when the page accepts the converted file or shows it in the picker.
- [ ] Lane 10. Load the same unpacked build in Firefox when Firefox is installed. Save `ext-lane-10.png`. Pass when the popup converts a PNG, or when the lane records that Firefox could not be installed.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Milliseconds from choosing jpeg in the popup until the download starts, for the 32 by 32 PNG. Trunk has no popup, so the metric is this head path and the file the user saves.
- [ ] Probe. Time that click path five times in Chromium at head. Attempt the same click path once on trunk and record that the extension is absent.
- [ ] Baseline. Trunk has no extension. Record that before the head samples.
- [ ] Rule. Head fails when the download has not started within 5000 ms. Do not divide by a trunk time.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 and lane 4 screenshots into `media/convert-extension-review-popup.png` and `media/convert-extension-review-toast.png`.
- [ ] Record a 30 to 60 second video of the popup and the toast on a lane VM. Save it as `media/convert-extension-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] The operator lands this pull request onto `convert-core` and then onto trunk. This session does not merge it.

## Ship the Windows package (convert-windows)

**Depends on.** convert-core. Branch `convert-windows` from `convert-core`.

**Files.**

- [ ] Create `apps/windows`.
- [ ] Create `docs/store-listings/windows.md`.

**Build.**

- [ ] An MSIX package whose Explorer verb is Convert to, with a submenu of graph targets for the selected files, plus a small window that converts several files.

**You see.**

- [ ] On a Windows 11 clone, Explorer shows Convert to for a selected PNG, and a two-file convert writes two real outputs.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] `apps/windows` tests call `ConversionJob` for two fixtures in one invocation. Run that test on Linux before the VM proof.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `grok-4.7-xhigh-fast` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Trunk has no Explorer verb, so record that and gate the new submenu plus two output files. Save `win-lane-1.png`. Pass when the submenu is visible and both outputs exist.
- [ ] Lane 2. Right-click one PNG and read the submenu. Save `win-lane-2.png`. Pass when every item is a graph target for png and heic is absent.
- [ ] Lane 3. Choose jpeg from that submenu. Save `win-lane-3.png`. Pass when the sibling jpeg starts with jpeg magic.
- [ ] Lane 4. Select two files and convert both. Save `win-lane-4.png`. Pass when both outputs are valid files of the chosen type.
- [ ] Lane 5. Right-click a markdown file. Save `win-lane-5.png`. Pass when the submenu offers docx and pdf and does not offer mp3.
- [ ] Lane 6. Open the app window with no selection. Save `win-lane-6.png`. Pass when the window explains that no file is selected.
- [ ] Lane 7. Convert a WAV from the submenu. Save `win-lane-7.png`. Pass when `ffprobe` reports an audio stream in the output.
- [ ] Lane 8. Confirm the package is an MSIX and is not submitted to the Store. Save `win-lane-8.png`. Pass when the manifest identity is present and no submit command ran.
- [ ] Lane 9. Capture the gateway clone line. Save `win-lane-9.png`. Pass when stderr contains a `[verify-gw] clone` line. A failed login is BLOCKED, not PASS.
- [ ] Lane 10. Repeat the two-file convert after closing and reopening Explorer. Save `win-lane-10.png`. Pass when the second run also writes both files.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Milliseconds to convert two 32 by 32 PNGs to jpeg from the app. Trunk has no app, so the metric is this head path and the two files on disk.
- [ ] Probe. Time the two-file command five times at head. Attempt it once on trunk and record that the command is absent.
- [ ] Baseline. Trunk has no Windows app. Record that before the head samples.
- [ ] Rule. Head fails when the two files are not both written within 15000 ms. Do not divide by a trunk time.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 2 and lane 4 screenshots into `media/convert-windows-review-menu.png` and `media/convert-windows-review-batch.png`.
- [ ] Record a 30 to 60 second video of the submenu and the two-file convert. Save it as `media/convert-windows-review.mp4`.
- [ ] Post the screenshots and the video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root's clean verdict at the exact head SHA.
- [ ] Bugbot triage done.
- [ ] The operator lands this pull request onto `convert-core` and then onto trunk. This session does not merge it.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Reply to the operator with the report the execution playbook names.

## Appendix A. Prototype evidence

The spike lived in `/tmp/spike` and was not committed. sharp 0.34.4 writes jpeg, png, webp, avif, and gif, reads SVG, and refuses HEVC HEIC with the message Unsupported compression. `heic-decode` 2.1.0 decoded a real HEIC sample to RGBA. `heif-enc` reported no HEVC encoder. ffmpeg 6.1.1 wrote bmp, ico, wav, mp3, flac, ogg, m4a, mp4, webm, mov, and gif. pandoc 3.1.3 wrote docx, odt, rtf, html, and plain text, and refused PDF because pdflatex is absent. Its input format list has no `plain` reader, so text input uses the markdown reader and text output uses the plain writer. LibreOffice was not installed. Firefox was not in apt. The first png-to-jpg samples on this VM were 19, 7, 2, 1, and 0 ms.

What stays unproven until later pull requests. The unpacked extension in Chromium, the upload toast on a public site, and the Explorer submenu on a Windows 11 clone.

## Appendix B. Alternatives rejected

One graph, not two. Browser and Windows each register the engines they can run. A second graph would drift.

HEIC as a target waits. No HEVC encoder is available to sharp or to libheif on this machine. The graph does not advertise a pair the engine cannot write.

SVG as a target waits. Raster-to-vector tracing is a different product. SVG is an input to the raster engines only.

GPL ffmpeg inside the extension waits. The core shells out to a system ffmpeg. The extension will use permissive image codecs and will not upload bytes. Audio and video in the extension stay out until a license-compatible wasm build is real.

Pandoc stays a host subprocess. It is GPL-2.0 or later. The package that ships does not vendor it. `OfficeEngine` covers the same document pairs with text fidelity when pandoc is absent. PDF is `pdf-lib` plus `pdfjs-dist`, because pandoc has no PDF engine here.

macOS Finder Quick Actions, Nautilus and Dolphin menus, and a CLI wait. The operator asked for a plan, not those builds. `ConversionJob.run` is the seam they would call. A Finder action needs a signed app and a Mac, and this session has neither. The Linux file-manager menus are small, and they were named as later targets so this round can prove Windows and the browser first. A CLI would be a thin wrapper over the same job, and shipping it now would add a third interface before those two menus exist.

## Appendix C. Risks

`convert-core` can reach mp4 from a PNG because gif sits in both the still-image set and the video set. The chain is real. A one-frame movie is the result. The menus must show it only because the graph does.

`libheif-js` is LGPL-3.0. `heic-decode` is ISC and loads that wasm. HEIC decode stays in the Node host. Replacing the wasm package must stay possible. The extension does not bundle it until the listing can carry the LGPL notice.

sharp is Apache-2.0 and bundles libvips, which is LGPL-2.1 or later, inside its Node addon. The extension does not ship that addon. The Windows package may ship the win32 addon and must keep the libvips notices beside it.

System ffmpeg on Ubuntu links libx264, which is GPL-2.0 or later. The core never copies that binary into npm. It only executes `ffmpeg` when the program is on `PATH`.

JSZip is MIT or GPL-3.0-or-later. This repo uses it under MIT.

Push to `quark/convert` returned HTTP 403 for the injected git token. `origin repo view quark/convert` works from the coordinator VM. Retrying the same token will not succeed. The bundle at `internal/convert.bundle` in the project store is how another VM opens the pull requests. Do not open them on the temporary origin remote.

`control-ui` is not installed. Live lanes name Playwright, the Node probe, and the Windows verify gateway instead.

## Appendix D. Links and reading list

Read this file before editing an engine. `convert-extension` and `convert-windows` get `pstack/skills/how/SKILL.md` only if they have to change the graph. They should not. `pstack/skills/interrogate/SKILL.md` applies before those pull requests ship if the menu design is still contested. The decision trail for this run lives in the project store under `internal/`, not in git, so the bundle stays free of credentials.

### Engine licenses

```
sharp 0.34.4 Apache-2.0, bundles libvips LGPL-2.1-or-later, Node only
heic-decode 2.1.0 ISC, loads libheif-js 1.23.5 LGPL-3.0, decode only
ffmpeg system binary, subprocess, GPL build likely because of libx264, not vendored
pandoc 3.1.3 subprocess, GPL-2.0-or-later, not vendored
pdf-lib 1.17.1 MIT
pdfjs-dist 4.8.69 Apache-2.0
exceljs 4.4.0 MIT
jszip 3.10.1 used under MIT
yaml 2.6.1 ISC
fast-xml-parser 4.5.1 MIT
smol-toml 1.3.1 BSD-3-Clause
OfficeEngine, BmpCodec, IcoCodec, and the graph are project code
```

### Conversion matrix

Targets below are what `npm run matrix` printed on this VM with ffmpeg and pandoc installed. A chain is included. heic and svg are never targets. Audio does not reach video, images, or documents. A json, yaml, xml, or toml value that is not an array of objects returns not-tabular for csv, xlsx, and ods even though those targets stay listed for tabular documents.

```
png     avif bmp gif ico jpg mov mp4 webm webp
jpg     avif bmp gif ico mov mp4 png webm webp
webp    avif bmp gif ico jpg mov mp4 png webm
avif    bmp gif ico jpg mov mp4 png webm webp
gif     avif bmp ico jpg mov mp4 png webm webp
bmp     avif gif ico jpg mov mp4 png webm webp
ico     avif bmp gif jpg mov mp4 png webm webp
svg     avif bmp gif ico jpg mov mp4 png webm webp
heic    avif bmp gif ico jpg mov mp4 png webm webp
docx    html md odt pdf rtf txt
pdf     docx html md odt rtf txt
md      docx html odt pdf rtf txt
html    docx md odt pdf rtf txt
txt     docx html md odt pdf rtf
odt     docx html md pdf rtf txt
rtf     docx html md odt pdf txt
xlsx    csv json ods toml xml yaml
csv     json ods toml xlsx xml yaml
ods     csv json toml xlsx xml yaml
json    csv ods toml xlsx xml yaml
yaml    csv json ods toml xlsx xml
xml     csv json ods toml xlsx yaml
toml    csv json ods xlsx xml yaml
mp3     flac m4a ogg wav
wav     flac m4a mp3 ogg
flac    m4a mp3 ogg wav
ogg     flac m4a mp3 wav
m4a     flac mp3 ogg wav
mp4     avif bmp gif ico jpg mov png webm webp
webm    avif bmp gif ico jpg mov mp4 png webp
mov     avif bmp gif ico jpg mp4 png webm webp
```

Chains a caller can see in `steps`. svg to bmp is svg, png, bmp. heic to jpg is heic, png, jpg. md to pdf is md, txt, pdf. mp4 to png is mp4, gif, png. yaml rows to csv is yaml, json, csv.
