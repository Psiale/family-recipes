# Manual recipe entry comparison

Researched November 6, 2026. Scope: documented manual authoring flows and public
adoption signals, to inform Family Recipes after deferring media extraction.
This is product research, not a newly implemented editor or usability test.

## Which examples have substantial adoption?

The same-platform proxy below is the cumulative Android install bracket shown
by each publisher's Google Play listing. These are not active-user counts,
cross-platform totals, market share or proof that a specific authoring flow is
most used. No comparable public manual-upload usage dataset was found. Among
these four examples, Cookpad has the largest published Android install bracket;
Samsung Food and Recipe Keeper share the next bracket, so cannot be ranked apart.

| Product | Android install bracket | Source |
| --- | --- | --- |
| Cookpad | 10M+ | [Google Play](https://play.google.com/store/apps/details?id=com.mufumbo.android.recipe.search&hl=en_US) |
| Samsung Food | 1M+ | [Google Play](https://play.google.com/store/apps/details?id=com.foodient.whisk&hl=en_US) |
| Recipe Keeper | 1M+ | [Google Play](https://play.google.com/store/apps/details?id=com.tudorspan.recipekeeper&hl=en_US) |
| Paprika Recipe Manager 3 | 500K+ | [Google Play](https://play.google.com/store/apps/details?id=com.hindsightlabs.paprika.android.v3&hl=en_US) |

Paprika's currently linked Android authoring guide is for version 4 and some pages
are labeled beta. The install bracket above belongs to the version 3 listing;
it must not be presented as a measured version 4 audience.

## Authoring patterns

**Samsung Food:** Saved recipes → add button → create a recipe → title and
optional description/source/photo → ingredient rows and ordered instruction rows
→ servings/times/collection → save. Both ingredient and instruction entry support
pasting several lines; the next row appears as the user enters text. Ingredients
can have named groups. This is the clearest documented structured-entry example.
[Official create/edit guide](https://support.samsungfood.com/hc/en-us/articles/18369261226644-Getting-Started-with-Samsung-Food-Create-and-Edit-Recipes).

**Cookpad:** Its manual-authoring guidance emphasizes a finished-dish image, a
descriptive title and personal background, then ingredients with quantities and
separate preparation steps. Ingredient groups and step images help explain
multi-part recipes. This supports the family-story aspect of our app. The linked
manual guidance was published in 2020; treat it as an authoring pattern, not proof
of the exact current screen sequence. Current listings also promote AI imports,
which are outside our scope.
[Official manual contribution guidance](https://blog.cookpad.es/2020/05/como-compartir-tus-recetas-en-cookpad.html).

**Paprika 4:** Add a blank recipe → fill the recipe editor → save. Secondary
metadata such as timing, yield and source starts in a collapsed information
section. Ingredients and directions are editable fields; ingredient groups can
be represented by headings. This demonstrates progressive disclosure for a
personal recipe organizer. The v4/beta documentation caveat above applies.
[Adding recipes](https://www.paprikaapp.com/help/v4/android/addingrecipes/),
[editing and fields](https://www.paprikaapp.com/help/v4/android/editingrecipes/).

**Recipe Keeper:** Its publisher emphasizes entering only the information the
user needs, pasting existing text, then optional course/category organization,
photos and favorites. It is a useful low-friction personal-collection reference.
The public page establishes those capabilities, not a verified tap-by-tap editor
sequence. Its OCR/import options are separate and outside our scope.
[Official product description](https://recipekeeperonline.com/).

## Suggested direction for Family Recipes

Recommendation, not a claim about conversion rates or a change implemented by
this research:

1. Enter directly from Recipes → Create recipe into ordinary manual authoring.
2. Keep title, ingredients and preparation steps prominent. Let quantities remain
   human wording such as “un puñito”; do not force exact unit conversion.
3. Make adding/reordering ingredients and numbered steps easy. Evaluate bulk paste
   and named sections as later editor improvements, using Samsung Food as a reference.
4. Keep provenance, family story, servings and timing available without making
   every optional field part of the initial task. Paprika's metadata grouping and
   Cookpad's personal context are useful references.
5. Keep sharing explicit and private by default. Review/save through the existing
   audited recipe operation; saving and public publication are distinct concepts.

The current recipe-core editor already provides manual title/story/provenance,
servings/times, ingredient quantities/units/notes, ordered steps, private creation,
optional initial family sharing and revision history. It is one editor, not the
multi-step redesign suggested above. This change does not add bulk paste, draft
autosave, a new wizard, photo attachments, URL imports or automatic extraction.
Ordinary dish-photo attachments remain a separate media/storage feature.
