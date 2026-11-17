import { Link, useSearchParams } from 'react-router-dom'
import { api, dateOnly, useApi, useSession } from '@trueglaz/core'
import { ERASED, KEPT } from '../components/AccountData'
import './DeleteAccountPage.css'

/**
 * trueglaz.com/delete-account (TG-125): the public page Google Play asks every
 * app with accounts to link to. It has to work for somebody who has already
 * uninstalled the app, so it is open without signing in and says, in plain
 * words, how to ask, what goes, what stays and for how long.
 */
export function DeleteAccountPage() {
  const [params] = useSearchParams()
  const { session } = useSession()
  const meta = useApi(() => api.meta(), [])
  const scheduled = params.get('scheduled')
  const support = meta.data?.support

  return (
    <article className="del-page">
      <h1>Delete your TrueGlaz account</h1>

      {scheduled !== null && (
        <div className="del-page__done" role="status">
          <strong>Your account is scheduled for deletion{scheduled ? ` on ${dateOnly(scheduled)}` : ''}.</strong>
          <p>We have signed you out on every device and sent you a confirmation. Changed your mind? Sign in before that date and the deletion is cancelled.</p>
        </div>
      )}

      <section className="tg-card del-page__card">
        <h2>How to delete it</h2>
        <ol>
          <li><strong>In the app:</strong> Profile → Your data and account → Delete my account.</li>
          <li><strong>On the website:</strong> {session
            ? <Link to="/profile#your-data">Your account → Your data</Link>
            : <><Link to="/sign-in" state={{ from: "/profile#your-data" }}>sign in</Link>, then Your account → Your data</>} → Delete my account.</li>
          <li><strong>No longer have access?</strong> Write to {support?.email
            ? <a href={`mailto:${support.email}?subject=Delete%20my%20account`}>{support.email}</a>
            : 'our support team'} from the email on your account, and we will do it for you.</li>
        </ol>
        <p className="tg-muted">
          We send a one-time code to the email or phone on the account, so nobody else can delete it. Before deleting, you can
          download a copy of your data from the same screen.
        </p>
      </section>

      <section className="tg-card del-page__card">
        <h2>What happens next</h2>
        <ul>
          <li>You are signed out everywhere at once, and your wishes come off the board.</li>
          <li>We wait <strong>30 days</strong>. Sign in during that time and the deletion is cancelled.</li>
          <li>After 30 days the account is erased. This cannot be undone. Your email and phone can then be used for a new account.</li>
          <li>Anything still in progress (an order on its way, a return, money we owe you, gear of yours with us) has to finish first.</li>
        </ul>
      </section>

      <section className="del-page__cols">
        <div className="tg-card del-page__card">
          <h2>What we erase</h2>
          <ul>{ERASED.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
        <div className="tg-card del-page__card">
          <h2>What we keep, and why</h2>
          <ul>{KEPT.map((i) => <li key={i}>{i}</li>)}</ul>
          <p className="tg-muted">These records stay linked to an account that reads "Deleted user" and can no longer be signed into.</p>
        </div>
      </section>
    </article>
  )
}
