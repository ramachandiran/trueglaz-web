/**
 * Refuse to run inside someone else's frame (security round 2).
 *
 * Another site could load TrueGlaz invisibly in an iframe and trick a signed-in
 * person — a staff member approving a payout, say — into clicking through it
 * ("clickjacking"). The proper defence is the frame-ancestors header, added at
 * CloudFront (deploy/cloudfront-security-headers.js in the API repo); this is
 * the in-page backstop until then, and stays useful after: framed, the app
 * never renders, so there is nothing to click.
 */
export function framedByAnotherSite(): boolean {
  try {
    if (window.self === window.top) return false
    // Same-origin parents are ours (none today, but harmless to allow).
    return window.top?.location.origin !== window.location.origin
  } catch {
    // Reading a cross-origin parent's location throws: that is the framed case.
    return true
  }
}
