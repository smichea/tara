# Privacy

Tara's application code has no advertising SDKs, analytics, tracking pixels or
external AI API calls. Learning does not require a Tara account.

- Progress, XP, review dates, saved written responses, level/school/quiz selections, editor
  drafts and imported courses use browser
  local storage on the current device. They are not sent to a Tara database. Carina uses a separate local progress record from Marco; selecting a course restores its learner’s progress. A progress backup exports the current learner, while imported courses and the editor draft remain shared on this browser.
- An offline service worker caches the app, registered course files, bundled word meanings and the first lesson’s audio. Other audio is cached after listening.
- Word hints read bundled course data and make no dictionary or AI requests. Offline maintainer tools may send public course sentences to an AI provider to draft glosses. These glosses remain community-editable draft course content.
- Exported JSON backups and course files are downloaded to your device.
- Propose contribution opens a GitHub page with the proposed course content in
  its URL. GitHub receives that content when you follow the link, before you
  press Submit. Do not put secrets or private information into contributions.
- Contributions submitted on the public repository are public. GitHub has its
  own account and privacy terms. The app never creates GitHub issues itself.
- Sound plays stored files. The private Sites copy loads the shared public voice library from GitHub Pages; public and self-hosted copies serve their bundled files locally. Both cache recordings for offline use. Playback requires an individual recording review or a voice approved through listening tests in the course language. Browser text-to-speech
  is disabled. Offline maintainer tools can send public course text to a chosen
  synthesis provider; no API key or generation request is sent from the learning
  app. Playback runs only on a speaker-button tap. No microphone is requested.
- Multiplayer bank/game downloads remain on your device until you import them
  elsewhere. Opening Retro Museum follows an external link. A multiplayer host
  receives the nickname, optional avatar, answers and session credentials used
  there and may persist room state. Those are separate from Tara's local progress.
- GitHub Pages, Sites and other hosting providers receive ordinary web requests
  and may keep access logs or apply their own authentication. A private Sites
  deployment may require the owner's login; the public GitHub Pages version
  does not require a Tara login.

Use Settings to export progress or reset learning. Removing learning progress
keeps imported courses and editor drafts; clear site data to remove everything.
Deleting browser data also removes the offline cache. If a device is shared,
other people with access to its browser profile can see the stored progress and
drafts. No cloud sync or remote account deletion is necessary for Tara's local
learning data.
