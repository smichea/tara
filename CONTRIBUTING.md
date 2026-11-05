# Contributing to Tara

You can improve a word, add a useful phrase, write a lesson, review a language,
contribute a recording, or start a new course. A public pseudonym is welcome.
Avoid personal details in lessons and examples.

## Without coding

Use the app's **Community** editor, preview the course locally, export a JSON
copy, then choose **Propose contribution**. GitHub opens a proposal for you to
review and submit. The app does not send it automatically. A GitHub account is
needed to submit proposals; learning and local editing need no account.

For a small correction, open a [course issue](https://github.com/smichea/tara/issues/new?template=course.yml)
with the language, lesson, current phrase, suggested replacement and reason.
Large JSON exports can be pasted in fenced code blocks or attached in a ZIP.

## With Git

1. Fork the repository and create a branch.
2. Edit a course JSON file or create a new language pair. See [course format](docs/course-format.md).
3. Register new files in `dist/courses/index.json`.
4. Keep existing author attribution; add your name or public handle.
5. Run `npm run check` and try the affected lesson with `npm run dev`.
6. Open a pull request describing the real-life skill the lesson teaches.

## Content review

A contributor cannot self-certify a shared course through the editor. Local
imports are always drafts. Maintainers review every change before merging.

- Automated checks require unique IDs, valid fields, bounded content, existing
  local audio files and an explicit content license. CI failure blocks release.
- A fluent speaker checks meaning, natural phrasing, politeness, regional
  variation, accepted spellings and whether examples suit young learners. A teacher
  also reviews level targets, comprehension explanations, open-task rubrics and
  any claimed mapping to school competencies. See docs/curriculum.md.
- A maintainer checks attribution and third-party permission. Do not copy
  proprietary courses, commercial recordings or unattributed learning decks.
- Set `status` to `reviewed` only after an independent fluent reviewer signs
  off on the **whole current course**, and add their public name to `reviewers`.
- Content changes to a reviewed course reset it to `draft` until re-reviewed.
- Draft material may be released for early feedback, visibly labelled as such.

GitHub permissions enforce who can merge. The human-review policy is documented;
it is not an automated claim of language correctness. Branch protection can be
configured by a repository administrator as the maintainer group grows.

## Audio

Native recordings are preferred to synthetic speech. Use a quiet room, speak
naturally and get the speaker's permission. Put files under `dist/audio/` and
set an entry's `audio` path to `audio/fil/example.mp3`, with a text- and byte-bound
`audioReview` after an independent pronunciation check. See [the audio pipeline](docs/audio.md)
for pilot generation, review, promotion and Git LFS. Add attribution in
`docs/audio-attribution.md`. Audio must be contributed under CC BY-SA 4.0; do
not record or upload another person's voice without permission. The visual
editor preserves existing audio references; adding recordings is a pull-request
workflow in v0.1.

## Code and design

Code is AGPL-3.0-or-later; language content and audio are CC BY-SA 4.0. Keep the runtime
independent of paid APIs, advertising, analytics and unnecessary dependencies.
All learner features should remain usable without account creation. Preserve
keyboard access, mobile layouts and offline behavior. Add meaningful regression
tests for learning logic or import-validation changes.
