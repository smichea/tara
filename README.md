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

- 12 short Filipino lessons with 48 words and phrases, taught before they are tested.
- Meaning choices, sentence building and written recall; mistakes get another attempt.
- Spaced repetition, completed lessons, daily goals, streaks and XP stored on the device.
- Phrasebook with search; audio recordings or a matching installed system voice, when available.
- Responsive interface and an offline service worker; install through the browser when supported.
- A visual course editor for words, phrases, teaching tips, accepted spellings and new language pairs.
- Local course import and export; editor drafts save as you type.
- GitHub contribution proposals from the editor, pull requests, automatic content validation and a documented review process.
- Progress backup and restore, including imported courses.

## Honest limits

This is **v0.1**, not a complete course or a substitute for speaking with people. The Filipino starter content is an original draft **awaiting fluent-speaker review**. It has no human audio recordings yet. The app enables speech only if an appropriate voice or recording exists; it does not read Filipino with an English voice. No voice recognition or pronunciation scoring is claimed.

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
