# MyBlog

A multi-user blogging application built with Node.js, Express, EJS, JavaScript, CSS, and PostgreSQL. Visitors can read public posts, while registered users can publish and manage their own writing.

[GitHub repository](https://github.com/Bimbzzyjane/my--blog-page)

## Live Demo

Live Demo: [MyBlog on Render](https://myblog-app-whpc.onrender.com/)

Hosted as a Render Web Service with PostgreSQL for application data and sessions.

## Features

- Registration and email/password sign-in with bcrypt password hashing and form validation.
- Google OAuth sign-in through Passport, subject to the database setup requirement below.
- PostgreSQL-backed sessions and logout that destroys the session and clears the cookie.
- Public homepage showing posts, authors, and creation dates, newest first.
- Create, edit, and delete posts, with a confirmation prompt before deletion.
- Ownership checks so users can edit and delete only their own posts.
- Personal **My Posts** page with an empty state linking to the post creation form.
- Responsive layouts for desktop, tablet, and mobile using shared EJS partials and CSS.


## Tech Stack

| Area | Technologies |
| --- | --- |
| Server | Node.js, Express.js, JavaScript ES modules |
| Views and styling | EJS, HTML, CSS, CSS Grid and Flexbox |
| Database | PostgreSQL, `pg` connection pool |
| Authentication | bcrypt, Passport, `passport-google-oauth20` |
| Sessions | `express-session`, `connect-pg-simple` |
| Configuration | dotenv |
| Hosting | Render Web Service |

### Authentication and ownership

Local registration normalizes email addresses and hashes passwords with bcrypt using 12 salt rounds. Sign-in compares the submitted password with the stored hash. Both password and Google sign-in regenerate the Express session and store the user ID in `req.session.userId`; middleware loads the authenticated user into `res.locals.user`.

Google sign-in looks up a provider account in `auth_accounts`. New Google accounts require a verified email and are created without a local password. An existing local account with the same email is not automatically linked to Google.

Protected routes require authentication. Each post stores its owner's `user_id`, and edit/delete queries match both the post ID and the authenticated user ID. The templates display editing controls only for the owner; `/my-posts` queries only that user's posts.

## Local Setup

Prerequisites: Node.js with npm, PostgreSQL, and Google OAuth client credentials. Google credentials are needed at startup because the strategy is configured unconditionally.

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/Bimbzzyjane/my--blog-page.git
   cd my--blog-page
   npm install
   ```

2. Create a `.env` file in the project root using the variables below. `db/db.js` loads it through dotenv; `.env` is ignored by Git.
3. Complete the database setup below.
4. Configure a Google OAuth web client with this authorized redirect URI, matching `GOOGLE_CALLBACK_URL` exactly:

   ```text
   http://localhost:3000/auth/google/callback
   ```

5. Start the application from the project root:

   ```bash
   npm start
   ```

   Open `http://localhost:3000`. The server uses `PORT` when provided and defaults to `3000`.

`npm start` runs `node index.js`. There is no `dev` script, and `npm test` is a placeholder; no automated test suite is configured.

## Environment Variables

The values below are examples only. Replace credential placeholders locally and keep secrets out of version control.

```dotenv
PG_USER=your_database_user
PG_HOST=localhost
PG_DATABASE=myblog
PG_PASSWORD=your_database_password
PG_PORT=5432
SESSION_SECRET=replace_with_a_long_random_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
NODE_ENV=development
PORT=3000
```

- `PG_USER`, `PG_HOST`, `PG_DATABASE`, `PG_PASSWORD`, and `PG_PORT` configure the PostgreSQL pool when `DATABASE_URL` is unset. `PG_PORT` defaults to `5432`.
- `DATABASE_URL` is an alternative PostgreSQL connection string and takes precedence over all `PG_*` settings. Example format: `postgresql://USER:PASSWORD@HOST:5432/DATABASE`. Set it only when using this connection method.
- `SESSION_SECRET` signs the session cookie.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` configure Google OAuth.
- `NODE_ENV=production` enables secure session cookies and configures Express to trust one proxy hop.
- `PORT` sets the HTTP listening port and defaults to `3000`.

## Database Setup

Create a PostgreSQL database matching `PG_DATABASE` (or the database in `DATABASE_URL`), then run the schema against that database. For the local `PG_*` example above:

```bash
createdb -U your_database_user -h localhost -p 5432 myblog
psql -U your_database_user -h localhost -p 5432 -d myblog -f db/schema.sql
```

Use your actual PostgreSQL username and connection settings. The schema creates `users` and `posts`, including the ownership foreign key and timestamps, and inserts a development user and two sample posts. That development user has no password; register a separate account to sign in. Run the schema once against a fresh database; it is not an incremental migration script.

**Google OAuth setup gap:** `auth/google.js` also requires an `auth_accounts` table with `user_id`, `provider`, and `provider_user_id` columns, but the repository does not include its table definition or migration. The supplied schema alone supports local accounts and posts; a compatible provider-account table must be created before Google sign-in can work on a fresh database.

The session store automatically creates its `session` table when needed (`createTableIfMissing: true`). The database role must have permission to create it.

To check database connectivity:

```bash
node test-db.js
```

This runs `SELECT NOW()`; it does not validate application tables or authentication.

## Deployment

MyBlog is deployed as a [Render Web Service](https://myblog-app-whpc.onrender.com/). The application uses PostgreSQL for users, posts, Google provider accounts, and sessions; the database hosting provider is not specified in the repository.

The install and start commands are `npm install` and `npm start`, with no frontend build step. The server reads the host-provided `PORT`, and the database pool accepts `DATABASE_URL` or individual `PG_*` settings. In production, Express trusts one proxy hop and enables secure session cookies.

Deployment configuration to maintain in Render:

- Set the database connection variables, `SESSION_SECRET`, Google client credentials, and `NODE_ENV=production` through the service's environment settings.
- Set `GOOGLE_CALLBACK_URL` and the Google client's authorized redirect URI to `https://myblog-app-whpc.onrender.com/auth/google/callback`.
- Ensure the database includes the Google provider-account table described above. Review database TLS requirements and the proxy configuration for the hosting environment.

Features above were checked against the repository code. Hosted authentication flows and production security hardening were not verified during this documentation update.

## Screenshots

### Homepage

![MyBlog homepage](screenshots/homepage.png)

### Create Post

![Create post form](screenshots/create-post.png)
