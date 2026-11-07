# Tara!

**A little practice. A real conversation.**

An open-source, ad-free language-learning app with community-editable courses. Courses teach Filipino for Marco and beginner French for Carina, both from English. Navigation is currently in English; course text and explanations are data-driven.

## Try it

Public app: **https://smichea.github.io/tara/**

```sh
git lfs install
git clone https://github.com/smichea/tara.git
cd tara
npm run dev
```

Open <http://127.0.0.1:4173>. Python 3 runs the development server; Node 20+ runs validation and tests. There are **no production dependencies, accounts, API keys or build steps**. Any static host can serve `dist/`, including under a subdirectory.

## What works today

- Carina’s 32 beginner French lessons (A1–A2): 128 expressions, 24 short readings, 48 comprehension questions and 24 expression tasks about catering, food, Paris, shopping, monuments and royal history. Historical texts link to official sources. Her local progress and XP are separate from Marco’s.

- 124 Filipino lessons with 576 key expressions, including A1–C2-inspired practice targets; the original 12 lessons and their progress IDs are preserved.
- 112 contextual readings (including two attributed historical excerpts), 224 comprehension questions with explanations, and 112 open expression tasks with model responses and self-checks.
- A school pathway from Grade 1 prerequisites through every Grade 2–7 and Grade 8, grouped by quarter with source references and suggested readiness checks.
- Level navigation and saved writing responses in localStorage; long-form expression is self-assessed, not compared against one required sentence.
- Meaning choices, sentence building and written recall; equivalent answers and optional Filipino politeness are accepted, while mistakes get another attempt.
- Spaced repetition, completed lessons, daily goals, streaks and XP saved automatically in localStorage, plus an explicit Save progress button in Settings.
- Searchable phrasebook and contextual English word hints on hover, keyboard focus or tap for all 576 expressions; meanings are editable in the community editor and work offline.
- Stored OpenAI Marin audio for phrases, readings and model responses, with normal/slower playback. The user approved this voice after listening to the 12-sample pilot; metadata distinguishes voice selection from individual clip review. Browser TTS is used only for English in the reverse courses below.
- Optional microphone practice for French and Filipino: the first microphone tap offers an explicit **85.5 MB** download with progress and cancellation. Verified tools stay in a separate durable cache for future/offline sessions. ZIPA recognises sounds locally; letters are highlighted, approximate recognised spelling can be synthesised, and the original voice can be replayed. IPA is off by default and available only through an advanced option. Recordings are temporary unless explicitly saved as WAV.
- English for Filipino speakers and English for French speakers, generated in the browser from the existing lessons (no extra course files): the English phrase becomes the one to learn, the Filipino or French text its translation. English contractions (*I'm* / *I am*) are both accepted, English is spoken with the device's own speech voice, and progress is kept separate. Filipino school-curriculum lessons, readings, writing tasks and usage notes are left out because they explain the original language. See [reverse courses](docs/reverse-courses.md).
- Filipino translation practice in both directions (Review → Translate sentences) for learned phrases. Matching answers, accents, optional *po*/*ho* and small typos are checked instantly. For Filipino, an optional **119.5 MB** offline checker (a small Opus-MT translation model in a Web Worker) reads back what a different wording means and gives feedback without internet; answers never leave the device. Without it, the learner compares with the course answer. See [translation practice](docs/translation.md).
- 15 downloadable Retro Museum quiz/game packs for shared-screen and phone play; the open host supports ranking and cooperative modes. See [multiplayer setup](docs/multiplayer.md).
- Responsive interface, reduced-motion-aware animations and an offline service worker; install through the browser when supported.
- A visual course editor for words, phrases, teaching tips, contextual word meanings, accepted spellings and new language pairs.
- Local course import and export; editor drafts save as you type.
- GitHub contribution proposals from the editor, pull requests, automatic content validation and a documented review process.
- Progress backup and restore, including imported courses.

## Honest limits

This is a guided practice course, not a complete CEFR syllabus, school qualification or substitute for speaking with people. Level labels describe editorial practice targets inspired by CEFR, not externally validated proficiency or a promise that completing a tab achieves that level. Course content is an original draft **awaiting fluent-speaker and teacher review**. See [curriculum notes](docs/curriculum.md) and [school alignment](docs/school-alignment.md). The school pathway bridges selected skills from every preceding grade; it does not claim exhaustive yearly coverage or replace assigned full literary works and live performance. The synthetic voice was selected after a user listening review of the 12-sample pilot. This is a voice approval, not a claim that every generated clip was individually reviewed or that all pronunciation is flawless. Individual clip reviews and corrected human recordings remain welcome. See [audio generation and review](docs/audio.md). The translation checker is a small translation model, not a teacher: it can misjudge informal or very short answers, so every verdict can be overridden and is labelled as automatic feedback. Optional speaking practice runs ZIPA locally in a Web Worker. It offers experimental sound comparisons, not a validated pronunciation score.

The shared contribution workflow uses **GitHub review**, not an in-app account system or a live database. Local drafts are not published automatically. A proposal opens on GitHub for the contributor to review and submit; a maintainer must integrate it and a fluent speaker must review language content. Review dates and learning progress are device-local; there is no cloud sync. Imported courses stay labelled as unreviewed drafts, even when their file claims reviewed status.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) and [the course format](docs/course-format.md). You can contribute without coding:

1. Open **Community → Create a course** or **Improve this course**.
2. Add words, phrases, explanations, or another language pair.
3. Try the draft locally. Export it to keep a portable copy.
4. Confirm the content license and choose **Propose contribution**.
5. Review and submit the prepared GitHub issue. Large courses are exported separately for attachment or pasting.

Contributors comfortable with Git can edit `dist/courses/*.json` and open a pull request. Register new courses in `dist/courses/index.json`. A fluent speaker is especially welcome to review the Filipino starter course and contribute recordings.

## Checks and hosting

```sh
npm run check
node --check dist/app.js
node --check dist/sw.js
```

Tests cover answer normalization, backup validation, scheduling, streaks, duplicate identifiers, multilingual content, unsafe audio paths, and repeated XP awards. CI validates every registered course on pushes and pull requests. GitHub Pages publishes `dist/` after these checks on `main`.

To self-host, copy `dist/` to a static web server. HTTPS or localhost is needed for service workers and installation. Bump the cache name in `dist/sw.js` when changing bundled assets. A single deployment contains all registered courses.

## Install and study offline

Open Settings → Manage downloads, or Downloads above the learning path. Choose
individual lessons, filter by level/search, or download the lessons currently
shown. Downloads include every available approved phrase, reading and model-response
recording. Keep Tara open until “Ready offline” appears. Interrupted downloads
can be resumed; completed downloads can be removed without resetting progress.
All registered course text and word hints are cached with the app.

Use Install Tara when offered. On Android, Chrome’s menu also offers Install app
or Add to Home screen. On iPhone/iPad, use Safari → Share → Add to Home Screen.
Download lessons in the installed copy; its storage may differ from browser storage.
Settings exports a progress backup for transferring learning between copies/devices.

`dist/offline.js` verifies downloaded audio against the course SHA-256, commits
completion after every file is stored, and keeps selected lessons in independent
`tara-lesson-v1-*` caches. Updating the shell never deletes these caches. Cached
audio supports HTTP byte ranges for mobile players. “Keep downloads on this device”
requests persistent browser storage; the browser controls whether it is granted.
Clearing site data removes downloads and progress. Audio is not in progress backups.

Maintainer browser check: `node tests/offline-browser.mjs` (Playwright required).
It covers a never-played six-recording lesson, an app-shell update, offline reload,
real playback, mobile layout and removal preserving progress.

## License

- **App code:** [AGPL v3 or later](LICENSE).
- **Course text and contributed audio:** [CC BY-SA 4.0](CONTENT-LICENSE.md).
- Author attribution is included in each course. Preserve upstream attribution when modifying or redistributing a course.

No advertising, analytics, subscription gate or external AI backend. See [PRIVACY.md](PRIVACY.md).

Optional browser smoke test (with Playwright and Chromium available):

```sh
# Start npm run dev in another terminal first.
TARA_CHROMIUM=/path/to/chromium node tests/browser.mjs
```

The optional test needs the `playwright` package installed locally, or its module
path supplied in `TARA_PLAYWRIGHT_MODULE`; it adds no runtime dependency.

Recorded-audio and storage regression checks use the same optional Playwright setup:

```sh
TARA_CHROMIUM=/path/to/chromium node tests/audio-browser.mjs
TARA_CHROMIUM=/path/to/chromium node tests/audio-review-browser.mjs
TARA_CHROMIUM=/path/to/chromium node tests/audio-service-worker.mjs
TARA_CHROMIUM=/path/to/chromium node tests/glosses-browser.mjs
```

These checks verify recorded-file playback wiring with an explicit test fixture,
review gates and localStorage behavior. They do not validate audible pronunciation.

Extended reading, expression, editor preservation and offline regression checks:

```sh
TARA_CHROMIUM=/path/to/chromium node tests/curriculum-browser.mjs
TARA_CHROMIUM=/path/to/chromium node tests/school-browser.mjs
```

Translation checker calibration (real INT8 model in Node, part of `npm run check`): `npm run test:translation`. Browser QA with download, offline reload and removal: `TARA_PLAYWRIGHT_MODULE=/path/to/playwright/index.js node tests/translation-browser.mjs`.

French course and learner-isolation browser check: `node tests/carina-browser.mjs`.

Speaking browser QA (requires FFmpeg, or set `TARA_SPEECH_FIXTURE` to a WAV):

```sh
TARA_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/pronunciation-browser.mjs
```

This uses real ZIPA/WASM inference with a synthetic fixture, including a network-off reload. It does not establish human pronunciation accuracy or phone latency. ZIPA sometimes misrecognises approved model audio; the UI abstains from precise corrections on those words. Filipino spelling rules are a draft and stress is not assessed.
