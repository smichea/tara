# Reverse courses: English for Filipino and French speakers

Every registered course taught from English (`fromCode: "en"`) also appears as
an English course for speakers of its language:

| Source course | Generated course | Course id |
| --- | --- | --- |
| Filipino - from English | English - from Filipino | `en-from-fil` |
| French - from English | English - from French | `en-from-fr` |

They are built in the browser by `reverseCourse()` in `dist/reverse.js` when the
app starts. There are no extra JSON files or recordings, so every correction to a
source course (text, translation, a new lesson) appears in its reverse course too.

## What is reversed

- Each phrase swaps sides: the English translation becomes the text to learn, and
  the Filipino or French text becomes its translation. Lesson and entry ids are
  kept, so review history stays stable when the source course is corrected.
- English contraction variants are accepted automatically (*I'm* / *I am*,
  *don't* / *do not*, *can't* / *cannot*).
- Lesson titles, goals and levels are kept. "… in Filipino" in a goal becomes
  "… in English".

## What is left out, and why

- Usage notes, lesson tips, word hints and writing tasks explain the original
  language (for example, when to add *po*).
- Readings: their comprehension questions often discuss the original language
  or are written in it.
- Filipino school-curriculum and foundation lessons, which teach Filipino grammar
  and literacy (for example "Aklat is a noun").
- Translation practice and speaking (microphone) practice, which are built for
  Filipino and French.

## Sound

English has no recordings, so the device's own speech voice (browser
`speechSynthesis`) reads English phrases, normally and slowly. It is used only
for English: Filipino and French still play only reviewed or approved
recordings. Voice quality and offline availability depend on the device;
Android and iOS normally include an offline English voice.

## Progress and review

Each reverse course has its own learner profile (`learnerId` = course id), so
XP, streaks and reviews never mix with Marco's or Carina's progress. The English
sentences were written as translations for Filipino and French lessons; they
have not been reviewed as an English syllabus.
