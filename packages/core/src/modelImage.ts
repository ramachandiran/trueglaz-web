/**
 * The catalogue's own picture of a product model.
 *
 * These are stock images: one square, white-background photograph per model,
 * shipped as static assets and named for the model slug. A slug is enough to
 * find one, so there is no index to keep in step with the folder.
 *
 * They are NOT photographs of the unit being sold. On a used-gear marketplace
 * that distinction is the whole point — a buyer looking at a pristine studio
 * shot has been told nothing about the scuffed copy in the box. So a listing
 * that has its own photographs always shows those, and one that does not shows
 * the stock image with [STOCK_IMAGE_NOTE] beside it, never silently.
 */
export function modelImage(slug: string | null | undefined): string | null {
  if (!slug) return null
  return `/model-images/${slug}.webp`
}

/**
 * Said beside a stock image, every time one stands in for the real thing.
 *
 * "Not this unit" rather than "stock photo" because it is the fact a buyer
 * needs, and because it stays true whether the file behind it is the
 * manufacturer's photograph or the placeholder we ship until one arrives.
 */
export const STOCK_IMAGE_BADGE = 'Not this unit'
export const STOCK_IMAGE_NOTE = 'A picture of this model, not of the item being sold'
