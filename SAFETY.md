# Safety

Influencer Studio is for **SFW content only: adults, fully clothed, respectful.** These rules are built into the app, not just written here.

## What the app allows

- **Adults only.** Every character is 21 or older. The builder has no younger age option, a request with an age under 21 is rejected by the server, and free text such as "17 years old" is blocked.
- **Fully clothed.** Every outfit is complete everyday, work, sport or costume clothing. Prompts always ask for a fully clothed person, and text asking to remove clothing is blocked.
- **Respectful.** Body sizes, types and creature looks are described neutrally. Silly and creature characters are playful costumes and make-up, never mocking a real group of people.
- **No real people.** Do not make pictures of real people without their consent. Text asking for the look of a real person, actor, singer, celebrity or politician is blocked.

## How it is enforced

- **Prompt compiler with safety rules.** Characters are built from fixed, reviewed option lists, so most of each prompt is written by the app, not typed by the user. Golden snapshot tests check the compiled prompts.
- **Blocked-terms filter** on every free-text field (names, spoken lines, sound-effect and music prompts, scene descriptions). It sees through capitals, accents, look-alike letters, leetspeak and spaced-out letters, and also blocks attempts to override the rules ("ignore previous instructions").
- **Negative prompts** steer the models away from nudity and unsafe content.
- **Safe models only.** `models.json` only lists models marked SFW with an allowed licence (Apache-2.0, MIT, or the LTX-2 Community License accepted in the app). The app cannot download anything else, and every file is checked against a stored SHA-256.
- **Server-side checks.** The server validates every job, so a changed browser page cannot skip the rules.

## Style references and uploads

You can add a style reference picture (PNG, JPEG or WebP, up to 8 MB). Only use pictures you have the right to use, of adults, and never a real person's likeness without their consent. Files are checked by content and stored on your computer under a random name. They are never uploaded.

## Limits

The guard rails are best effort, not a guarantee. AI models can still produce something unexpected, and the app does not yet run an automatic image safety check on outputs or style references. You are responsible for what you make and share. Please follow the law where you live and the rules of any site you post to, and label AI-generated content where required.

## Reporting

If the app makes something unsuitable, or a filter misses or wrongly blocks something, please [open an issue](https://github.com/OpenInfluencerStudio/influencer-studio/issues) with the settings you used (About > Copy report helps). Do not attach unsuitable images to a public issue; describe them instead.
