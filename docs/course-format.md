# Course format v1

The engine loads `dist/courses/index.json`. Each item is a unique course ID and
safe, local JSON filename:

```json
[{"id":"fil-en","file":"fil-en.json"}]
```

Each course is independent. A new language pair requires a new JSON file and a
registry entry; no learning-engine code changes. The JSON format supports Unicode
scripts, language codes and accepted answer variants. Interface navigation is
currently in English; translations and explanations are course content.

A minimal course:

```json
{
  "schemaVersion": 1,
  "id": "es-en",
  "title": "Spanish: first words",
  "language": "Spanish",
  "languageCode": "es",
  "fromLanguage": "English",
  "fromCode": "en",
  "author": "Your public contributor name",
  "license": "CC-BY-SA-4.0",
  "status": "draft",
  "reviewers": [],
  "lessons": [{
    "id": "greetings",
    "title": "Say hello",
    "goal": "Greet a friend.",
    "tip": "Use this with someone you know.",
    "entries": [{
      "id": "greetings-hello",
      "kind": "phrase",
      "text": "¡Hola!",
      "translation": "Hello!",
      "note": "A simple everyday greeting.",
      "accepted": ["Hola"]
    }]
  }]
}
```

## Validation contract

The authoritative validator is `validateCourse()` in `dist/lib.js`, shared by
the app and CI. Run `npm run validate` after editing. JSON syntax and required
fields are checked before import. Maximum imported JSON size: 2 MB.

- IDs: lowercase ASCII letter first, followed by lowercase letters, digits or
  hyphens, up to 64 characters. Lesson and entry IDs are unique across a course.
- Keep IDs stable when correcting a phrase; progress uses `courseId:entryId`.
  Give a materially different phrase a new ID. IDs can repeat in other courses.
- Course title, language names and author: 1–100 characters.
- `languageCode` / `fromCode`: two or three lowercase letters, with optional
  BCP-47-like subtags such as `pt-BR`. Use `fil` for Filipino and `en` for English.
  They must differ.
- 1–300 lessons per course; 1–32 entries per lesson.
- Each lesson needs a title (100 max) and practical goal (300 max); an optional
  teaching tip is at most 1,000 characters.
- Each entry needs `id`, `kind` (`word` or `phrase`), `text` and `translation`
  (300 characters each). Optional `note`: 600 characters. `accepted`: up to 12
  alternative answers, 300 characters each.
- Optional `audio`: a local path such as `audio/fil/hello.mp3` (MP3, OGG or WAV).
  Remote URLs and path traversal are rejected. `audioReview` is required: approved
  status, exact text, reviewer, ISO review date, audio SHA-256 and all four checks
  (pronunciation, stress, naturalness, completeness). CI verifies bytes and rejects
  Git LFS pointers. See [audio workflow](audio.md).
- `status`: `draft` or `reviewed`. Reviewed shared courses require named
  `reviewers` and human sign-off. Local imports are always shown as drafts.
- Optional `derivedFrom`: prior course ID, author and license; created by the
  editor when improving an existing course, to preserve upstream attribution.
- Optional `attributions`: up to 100 upstream credit objects (courseId, author, license). The editor preserves these through repeated community edits.
- `license` is `CC-BY-SA-4.0`. Do not overwrite another author's credit.

## How exercises work

Learners see each phrase, translation and usage note before practicing. The
engine makes meaning-choice questions and written/word-order recall exercises.
Answer checking ignores case, common punctuation and repeated whitespace, while
preserving meaningful accents and diacritics. Equivalent spellings, contractions and sentence structures belong in `accepted`.
In Filipino courses, adding one optional `po` or `ho` is also accepted when the
answer otherwise matches. Required respectful forms are preserved. Other words,
including negation and pronouns, are not discarded. Distinct meanings serve as choice distractors.

Sound uses reviewed recordings only; browser text-to-speech is disabled. Files
are served locally and cached for offline use. A text edit invalidates its old
pronunciation review, so replace the audio/review or remove the audio reference.
For writing systems with no spaces, written
recall is used instead of an English-style word-order puzzle. Dedicated word
segmentation, right-to-left interface localization, pronunciation scoring and a
full translation system for the app's navigation remain future work.

## Leveled lessons, context and expression

All fields below are optional for backward compatibility with v1 courses.

- `level`: `A1`, `A2`, `B1`, `B2`, `C1` or `C2`. This is a practice target, not
  certification. The engine groups lessons by this value and remembers the
  selected target per course.
- `reading`: `{title, text, translation, questions}`. Title: 150 characters;
  text and translation: 7,000 each. A reading has 1–8 questions.
- Optional reading `source` (HTTPS URL, 1,000 characters) and `attribution`
  (1,200 characters) preserve source and historical-excerpt credit in the reader.
- Each question has `{prompt, options, answer, explanation}`. There are 2–4
  distinct options (500 characters each), a zero-based integer `answer`, and
  a required explanation (1,200 characters max). Prompt: 500 characters max.
- `task`: `{prompt, model, checklist}`. Prompt: 1,600 characters; model: 7,000;
  1–8 checklist points of up to 400 characters each. A model is one possible
  answer. Open responses are saved locally and self-assessed, never rejected
  for differing from the model.
- `foundation`: optional boolean for preparatory literacy practice; this is not
  a claim of an official Grade 1 Filipino syllabus.
- `school`, for a sourced draft mapping: `{program, grade,
  quarter, skills, source}`. `program` is `DepEd-MATATAG`; grade is 2–10;
  quarter is 1–4; skills contains 1–12 short descriptions; source is an HTTPS
  curriculum reference. Merely adding this metadata is not approval or a claim
  of full grade coverage.

The visual editor supports levels, readings, translations, comprehension
questions, source credits, school stage/quarter/skills and expression tasks.
It shows one lesson at a time, preserving the
rest of the course during editing and export. Existing imported courses that
lack these fields continue to work.

Contextual lessons follow this sequence: learn key expressions → read/listen
with optional instruction-language support → practise recall and comprehension
→ write and compare a personal response. Comprehension results affect session
accuracy but are not scheduled as vocabulary flashcards. Saved writing is
included in progress backups. Older backups without writing remain supported.
