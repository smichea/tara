# Privacy

Tara's application code has no advertising SDKs, analytics, tracking pixels or
external AI API calls. Learning does not require a Tara account.

- Progress, XP, review dates, editor drafts and imported courses use browser
  local storage on the current device. They are not sent to a Tara database.
- An offline service worker caches the app and registered course files.
- Exported JSON backups and course files are downloaded to your device.
- Propose contribution opens a GitHub page with the proposed course content in
  its URL. GitHub receives that content when you follow the link, before you
  press Submit. Do not put secrets or private information into contributions.
- Contributions submitted on the public repository are public. GitHub has its
  own account and privacy terms. The app never creates GitHub issues itself.
- Browser text-to-speech is the default for sound. It may use your device
  provider's online voice service, according to its settings; there is no Tara TTS
  server or API key. Optional fallback audio files are served by the host.
  Speech runs only when
  you press a speaker button. The app requests no microphone access.
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
