# Recipe photo import

This slice imports one existing JPEG, PNG or HEIC photo. Audio, video, camera
recording, batch imports and source attachment storage remain deferred.

The flow is photo preview → editable OCR text → proposed recipe fields → explicit
review/save. The full corrected source stays visible while completing the draft.
Only recipe fields are sent to the existing audited recipe RPC; images and source
reference text are never persisted in Supabase. Source cache copies and previews
are released on cancellation, replacement and leaving the draft.

## Dependencies and maintenance

- File selection, bounded image normalization and private cache access use the
  official Expo SDK packages already aligned to SDK 58.
- `modules/recipe-photo` is a local Expo module owned by this repository. It calls
  the vendor SDKs directly, avoiding a separately maintained community wrapper.
- Android uses Google's current `play-services-mlkit-text-recognition:19.0.2`
  (released October 26, 2026). Google Play services prepares the on-device model
  on first use, with a bounded wait. It needs a connection for that preparation;
  recognition then works offline. Devices without compatible Google Play services
  retain manual entry. The older bundled `text-recognition:16.0.1` was not selected.
- iOS uses Apple's built-in Vision text recognition, supported from the app's
  existing iOS 16.4 minimum. No model download is needed.
- `jpeg-js`, `react-native-blob-util`, the optional background downloader,
  ExecuTorch, Audio API and Expo Video are removed from this slice. There is no
  generative model or large model download.

Check vendor release notes and device compatibility when updating the pinned
Google dependency. This local bridge is application code: maintain it with the
Expo module API and test both vendor integrations after native dependency updates.
The Android module supplies narrow consumer rules retaining ML Kit's reflective
registrar constructors; exercise an optimized release APK when changing them.

Primary references:

- [Google ML Kit text recognition](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)
- [Google ML Kit release notes](https://developers.google.com/ml-kit/release-notes)
- [Google model installation API](https://developers.google.com/android/guides/module-install-apis)
- [Apple Vision text recognition](https://developer.apple.com/documentation/vision/recognizing-text-in-images)
- [Expo local modules](https://docs.expo.dev/modules/get-started/)

## Conservative draft mapping

The local TypeScript mapper recognizes Spanish/English ingredient and preparation
headings. It preserves ingredient quantities (including fractions and phrases
like “un puñito”), known unit wording, section labels and ordered instructions.
It never guesses missing ingredients, quantities, times, year or provenance.
Unmapped lines remain in the complete local source reference, with a manual-review
notice. A missing heading yields blank lists for the user to complete. Times and
year are entered manually. This is a proposal, not an interpretation of cooking
instructions by an LLM.

Limits: one photo up to 30 MB, downsampled before OCR to at most 2000×2000 pixels,
and 10000 characters of source text for draft mapping. Clear, single-column printed
recipes are the first target; blur, handwriting and multi-column layouts need
careful correction. Native OCR is unavailable in Expo Go and on web; those users
can enter recipes manually. No new database migration or hosted AI key is needed.

## Verification

Run app checks and the existing SQL/RLS/concurrency/Auth/PostgREST regression suite.
For Android, test a real local image through the native module, repeat after model
preparation in airplane mode, and verify the file picker, preview, corrected text,
private draft/save and temporary-file cleanup. The iOS native bridge needs an iOS
build/device check in addition to the JavaScript export. Report each platform's
actual verification separately; mocked tests do not verify native OCR.
