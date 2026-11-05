# Tara!

**A little practice. A real conversation.**

An open-source, ad-free language-learning app with community-editable courses. The first course teaches everyday Filipino from English. Navigation is currently in English; course text and explanations are data-driven.

## Try it

Public app: **https://smichea.github.io/tara/**

```sh
git clone https://github.com/smichea/tara.git
cd tara
npm run dev
```

Open <http://127.0.0.1:4173>. Python 3 runs the development server; Node 20+ runs validation and tests. There are **no production dependencies, accounts, API keys or build steps**. Any static host can serve `dist/`, including under a subdirectory.

## What works today

- 124 Filipino lessons with 576 key expressions, including A1–C2-inspired practice targets; the original 12 lessons and their progress IDs are preserved.
- 112 contextual readings (including two attributed historical excerpts), 224 comprehension questions with explanations, and 112 open expression tasks with model responses and self-checks.
- A school pathway from Grade 1 prerequisites through every Grade 2–7 and Grade 8, grouped by quarter with source references and suggested readiness checks.
- Level navigation and saved writing responses in localStorage; long-form expression is self-assessed, not compared against one required sentence.
- Meaning choices, sentence building and written recall; equivalent answers and optional Filipino politeness are accepted, while mistakes get another attempt.
- Spaced repetition, completed lessons, daily goals, streaks and XP saved automatically in localStorage, plus an explicit Save progress button in Settings.
- Phrasebook with search; stored, human-reviewed audio playback with normal/slower speed. Browser TTS is disabled; production recordings await pilot generation and review.
- 15 downloadable Retro Museum quiz/game packs for shared-screen and phone play; the open host supports ranking and cooperative modes. See [multiplayer setup](docs/multiplayer.md).
- Responsive interface, reduced-motion-aware animations and an offline service worker; install through the browser when supported.
- A visual course editor for words, phrases, teaching tips, accepted spellings and new language pairs.
- Local course import and export; editor drafts save as you type.
- GitHub contribution proposals from the editor, pull requests, automatic content validation and a documented review process.
- Progress backup and restore, including imported courses.

## Honest limits

This is a guided practice course, not a complete CEFR syllabus, school qualification or substitute for speaking with people. Level labels describe editorial practice targets inspired by CEFR, not externally validated proficiency or a promise that completing a tab achieves that level. Course content is an original draft **awaiting fluent-speaker and teacher review**. See [curriculum notes](docs/curriculum.md) and [school alignment](docs/school-alignment.md). The school pathway bridges selected skills from every preceding grade; it does not claim exhaustive yearly coverage or replace assigned full literary works and live performance. Stored audio must be checked clip by clip by a named fluent speaker before publication. No pronunciation quality has been claimed without listening review. See [audio generation and review](docs/audio.md). No microphone, speech recognition or pronunciation scoring is included.

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

## License

- **App code:** [MIT](LICENSE).
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
```

These checks verify recorded-file playback wiring with an explicit test fixture,
review gates and localStorage behavior. They do not validate audible pronunciation.

Extended reading, expression, editor preservation and offline regression checks:

```sh
TARA_CHROMIUM=/path/to/chromium node tests/curriculum-browser.mjs
TARA_CHROMIUM=/path/to/chromium node tests/school-browser.mjs
```
