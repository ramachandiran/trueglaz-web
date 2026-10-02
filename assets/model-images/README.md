# Catalogue thumbnails

One square, white-background picture per product model. They are shipped as
static files at `apps/web/public/model-images/<model-slug>.webp` and resolved
from a slug alone, so there is no index to keep in step with the folder.

Every model in the catalogue has a file today. Most are placeholders.

## What these are, and what they are not

They are pictures of a **model**. They are not pictures of the **unit** being
sold, and on a used-gear marketplace that difference is the product. A buyer
looking at a manufacturer's studio shot has been told nothing about the scuffed
copy in the box, so the app never shows one silently:

- a listing with photographs of its own always shows those, and says so;
- a listing without shows this picture, badged **Not this unit**, with a line
  under the gallery saying it is a picture of the model.

That rule lives in `ModelPhoto`, not in each caller, so it cannot be forgotten
at one call site.

## Before you add a real photograph

A manufacturer's product photography belongs to the manufacturer. A press or
media-centre licence usually covers editorial and press use — it does not
generally cover illustrating stock on a commercial resale marketplace, and
"it was on their website" is not a licence. Check the terms for each brand, or
use your own photographs of your own stock, which is also the only way to show
the actual unit.

`MANIFEST.json` therefore ships with every `imageUrl` and `credit` blank.
Fill them in only for images you have the right to publish.

## Adding images

Either drop files into `incoming/` named for the model slug and run:

    python3 scripts/model-images.py --normalise

which trims each one to its subject and centres it on a white 1200×1200 canvas,
or fill `imageUrl` in the manifest and run:

    python3 scripts/model-images.py --fetch

Both write straight to `apps/web/public/model-images/`, replacing the
placeholder. Nothing else needs changing — the front end finds the file by slug.

After adding a model to the catalogue, refresh the manifest and draw a
placeholder for it so no tile is ever empty:

    python3 scripts/model-images.py --manifest --placeholders

`--placeholders` never overwrites an image that already exists unless you pass
`--force`.
