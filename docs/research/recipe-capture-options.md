# Deferred recipe extraction research

Recorded November 6, 2026. Decision: retain manual recipe creation and defer all
voice-to-text, image-to-text and video-to-text features. PR #20 is excluded from
the merge. Its branch preserves the experiment; it is not part of the shipped app.
No external image-processing service has been enabled and no API credits have
been claimed or credentials configured by this work.

## Prior local experiment

The photo-only experiment used official Expo packages and a repository-owned
native bridge to Google ML Kit text recognition 19.0.2 on Android and Apple Vision
on iOS. It showed a photo preview, editable OCR text and an explicitly accepted
draft. Images/source reference text were temporary and not uploaded to Supabase.
Android needed initial model preparation through Google Play services, then
worked offline. A heading-based mapper proposed ingredients/steps without an LLM.

The optimized Android harness passed OCR, airplane-mode recognition, real file
selection and the production form callback boundary. R8 needed narrow rules to
retain ML Kit registrar constructors. The signed APK24 installed/launched; a full
signed-app login-to-photo-save flow and full iPhone integration were not verified.
APK24 contains the now-deferred capture experiment and should not be used as the
manual-entry baseline. The earlier verified APK23 contains profile deletion and
recipe core without capture. Neither artifact is a new build of a later merge.

ExecuTorch/audio/video and the JPEG/blob/background-downloader helper chain were
removed during the experiment. None of those capture additions, the photo bridge,
or its direct Expo picker/file/image dependencies belong in the manual-entry merge.
Audio/video extraction never reached accepted native end-to-end verification.

## Online alternatives considered

- [OpenAI image understanding](https://developers.openai.com/api/docs/guides/images-vision)
  with [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
  can propose fields conforming to the recipe schema. Schema conformance does not
  establish faithful transcription; omissions/inventions still need review.
- [Gemini document understanding](https://ai.google.dev/gemini-api/docs/document-processing)
  and [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
  offer another candidate for evaluation against the same sample photos.
- [Google Cloud Vision OCR](https://docs.cloud.google.com/vision/docs/handwriting)
  extracts printed/handwritten text; mapping into recipe fields remains separate.

An online flow would send a user-selected photo through our authenticated backend
to the provider and return a validated, editable draft. Provider keys would stay
server-side. This changes the previous on-device privacy decision and requires
an explicit product decision before implementation. Retention, data use, quotas
and operating costs must be checked again at that time.

## Credits and illustrative costs

The [OpenAI subscription-credit documentation](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)
checked on November 6, 2026 lists $100 monthly API credits for an eligible $100
ChatGPT Pro subscription. Claiming requires a paid subscription at least seven
days old, matching account email and ownership of the receiving API organization.
The first grant is prorated; unused credits expire each billing cycle. Image
understanding is covered. The user's actual eligibility/balance was not inspected.

Using [Standard API prices](https://developers.openai.com/api/docs/pricing) checked
that day, an illustrative request with 5,000 input tokens (image/instructions) and
2,000 billed output tokens (including any reasoning) gives:

| Model | Input/output USD per million tokens | Example cost per photo | Requests for $100 |
| --- | --- | --- | --- |
| GPT-6 Luna | $0.10 / $0.50 | $0.0015 | About 66,600 |
| GPT-6.1 Terra | $1.00 / $5.00 | $0.015 | About 6,600 |

These are arithmetic scenarios, not benchmarks, accuracy guarantees or fixed
per-image prices. Resolution/detail, output length, reasoning, retries, other API
usage and infrastructure affect the actual result. Before choosing a provider,
evaluate 20–30 representative recipes and measure fidelity and billed usage.

[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) offers free quotas
for selected models, with model/project-specific limits. Its
[unpaid-service terms](https://ai.google.dev/gemini-api/terms) include product
improvement use of submitted content; regional/account conditions need checking.
[Cloud Vision pricing](https://cloud.google.com/vision/pricing) lists the first
1,000 monthly units per feature as free. A unit is one feature applied to an
image, not necessarily one complete recipe; other Cloud resources can cost extra.

Do not treat a ChatGPT login/Codex session as an application backend. Any future
integration should use the supported API and an intentionally configured budget.
