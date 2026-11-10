/*
 * Model pictures are set by an admin (Admin → Model photos) and served by the
 * API; the web app reads them all at once through useModelImage. They are NOT
 * photographs of the unit being sold — on a used-gear marketplace that
 * distinction is the whole point — so wherever one stands in for a unit it
 * carries [STOCK_IMAGE_BADGE].
 */

/**
 * Said beside a stock image, every time one stands in for the real thing.
 *
 * "Not this unit" rather than "stock photo" because it is the fact a buyer
 * needs, and because it stays true whether the file behind it is the
 * manufacturer's photograph or the placeholder we ship until one arrives.
 */
export const STOCK_IMAGE_BADGE = 'Not this unit'

/**
 * The studio background every model picture is made on, and the frame colour
 * around it, so the padding of a picture that does not fill its box is
 * invisible. A warm light grey: calm on the dark app, a card on the cream web.
 * Keep it in step with the API's image pipeline and `--tg-photo-bg` on the web.
 */
export const PHOTO_BG = '#F3F1EA'
export const STOCK_IMAGE_NOTE = 'A picture of this model, not of the item being sold'
