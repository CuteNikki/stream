# stream

Sets your stream's title, category and tags on every platform at once:
Twitch and YouTube to begin with, Kick to come. You host it yourself, for
yourself: the first visit makes your account, and nobody can make another
after.

Since it holds the keys to your channels, signing in is kept strict:

- Password, with email verification and password resets
- Two-step sign-in by an authenticator app or emailed codes, with backup
  codes and trusted devices
- Passkeys, offered in the browser's autofill too
- A list of where you're signed in, any of which you can sign out
- Rate limits, kept in the database, tighter on passwords and emailed codes
- The platforms' tokens encrypted in the database

## Running it

You need Docker, a PostgreSQL database, a mail server to send from (for
sign-in codes and password resets), and a reverse proxy that serves stream
over HTTPS: passkeys and the platforms' sign-in need it.

```bash
git clone https://github.com/CuteNikki/stream.git
cd stream
cp .env.example .env    # then fill it in
docker compose up -d --build
```

stream listens on `127.0.0.1:3000`, or on `STREAM_PORT` if set, for your
reverse proxy. If the proxy runs in Docker, put both on a shared network
instead, in a `compose.override.yaml` next to `docker-compose.yml`. Each time
it starts, the database's migrations run first, in a one-off `migrate`
container, and stream only starts once they've gone through.

Open it at your `BETTER_AUTH_URL`, and it asks you to set up your account.

### Settings

All in `.env`:

| Setting                | What it's for                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`         | The PostgreSQL database                                                              |
| `BETTER_AUTH_SECRET`   | Signs sessions and encrypts the platforms' tokens: `openssl rand -base64 32`         |
| `BETTER_AUTH_URL`      | Where stream runs, e.g. `https://stream.example.com`                                 |
| `SMTP_URL`             | The mail server, e.g. `smtps://no-reply%40example.com:password@mail.example.com`     |
| `EMAIL_FROM`           | Who emails come from; `stream <no-reply@…>` at `BETTER_AUTH_URL`'s domain unless set |
| `<PLATFORM>_CLIENT_ID` | A platform's client id and secret, which turn it on (see below)                      |
| `STREAM_PORT`          | The port on `127.0.0.1` that `docker-compose.yml` publishes; `3000` unless set       |

Changing `BETTER_AUTH_SECRET` signs you out and disconnects every platform.

## Platforms

Each platform is turned on by a client id and secret in `.env`, from a
developer app of yours on that platform. The app's redirect URL is
`<BETTER_AUTH_URL>/api/auth/callback/<id>`: for example
`https://stream.example.com/api/auth/callback/twitch`.

| Platform | Id       | Settings                                   | Where to make the app                                                                                        |
| -------- | -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Twitch   | `twitch` | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | [Twitch developer console](https://dev.twitch.tv/console/apps), category "Broadcaster Suite"                 |
| YouTube  | `google` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud](https://console.cloud.google.com/apis/credentials), an OAuth client of type "Web application" |

For YouTube, the Google Cloud project also needs the **YouTube Data API v3**
turned on, and its OAuth consent screen set up, with yourself added as a test
user while it's in testing.

Then connect each one on the Platforms page. stream asks Twitch for
`channel:manage:broadcast`, and Google for `youtube.force-ssl`: what they need
to change your stream, and nothing else.

## Working on it

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun install
bun run db:migrate
bun run dev
```

`docker-compose.dev.yml` runs a database and [Mailpit](https://mailpit.axllent.org/),
which catches the emails stream sends, to read at http://localhost:8025. For
them, `.env` has:

```bash
DATABASE_URL=postgresql://stream:stream@localhost:54329/stream
BETTER_AUTH_SECRET=   # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000
SMTP_URL=smtp://localhost:1025
```

To connect platforms while developing, add
`http://localhost:3000/api/auth/callback/<id>` to their apps' redirect URLs.

`bun run deploy` pushes `main`, then pulls and runs `docker compose up -d
--build` on a server: the one SSH knows as `STREAM_SSH_HOST`, in the clone at
`STREAM_SERVER_DIR` (`~/stream` unless set), both in `.env.local`.

## Licence

[MIT](LICENSE)
