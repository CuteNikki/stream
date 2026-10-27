# stream

Sets your stream's title, category and tags on every platform at once:
Twitch and YouTube to begin with, Kick to come. It's for one person, you:
the first visit makes your account, and nobody can make another after.

Its sign-in is [tinderhaj](../tinderhaj)'s, kept for one account:

- Password, with email verification and password resets
- Two-step sign-in by an authenticator app or emailed codes, with backup
  codes and trusted devices
- Passkeys, offered in the browser's autofill too
- A list of where you're signed in, any of which you can sign out
- Rate limits, kept in the database, tighter on passwords and emailed codes
- Platforms' tokens encrypted in the database

## Running it locally

```bash
cp .env.example .env    # then fill it in, as below
docker compose -f docker-compose.dev.yml up -d
bun install
bun run db:migrate
bun run dev
```

`docker-compose.dev.yml` runs a database and [Mailpit](https://mailpit.axllent.org/),
which catches the emails stream sends, to read at http://localhost:8025. For
it, `.env` has:

```bash
DATABASE_URL=postgresql://stream:stream@localhost:54329/stream
BETTER_AUTH_SECRET=   # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
SMTP_URL=smtp://localhost:1025
```

Open http://localhost:3000, and it asks you to set up your account.

## Platforms

Each platform is turned on by a client id and secret in `.env`, from a
developer app of yours on that platform. The app's redirect URL is
`<BETTER_AUTH_URL>/api/auth/callback/<id>`: for example
`https://stream.niso.moe/api/auth/callback/twitch`. Add `http://localhost:3000/…`
too, to connect platforms while developing.

| Platform | Id       | Where to make the app                                                                                        |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Twitch   | `twitch` | [Twitch developer console](https://dev.twitch.tv/console/apps), category "Broadcaster Suite"                 |
| YouTube  | `google` | [Google Cloud](https://console.cloud.google.com/apis/credentials), an OAuth client of type "Web application" |

For YouTube, the Google Cloud project also needs the **YouTube Data API v3**
turned on, and its OAuth consent screen set up, with yourself added as a test
user while it's in testing.

Then connect each one on the Platforms page. stream asks Twitch for
`channel:manage:broadcast`, and Google for `youtube.force-ssl`: what they need
to change your stream, and nothing else.

## Deploying

On the server, `~/services/stream` is a clone of this repository, with its
own `.env`, which is never in the repository. Caddy serves it at
stream.niso.moe, from `~/services/caddy/sites/stream.caddy`.

`bun run deploy` pushes `main`, then pulls and runs `docker compose up -d
--build` on the server. The database's migrations run first, in a one-off
`migrate` container, and stream only starts once they've gone through.
