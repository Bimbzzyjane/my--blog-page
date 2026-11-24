import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import db from "../db/db.js";

passport.use( 
    new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        state: true,
    }, async (accessToken, refreshToken, profile, done) => {
        console.log(profile);
        console.log(done);
        const client = await db.connect()
        try{
            // Start a transaction
            await client.query("BEGIN");

            // Check if the user already exists in the auth_accounts table
            const existingAccount = await client.query(
                `SELECT user_id FROM auth_accounts 
                WHERE provider = $1 AND provider_user_id = $2`,
                ["google", profile.id]
            );

            if(existingAccount.rows.length > 0) {
                const userId = existingAccount.rows[0].user_id;
                await client.query("COMMIT");
                return done(null, userId);
            }

            //Only allow users with verified emails to sign up
            const emailInfo = profile.emails?.[0];
            const email = emailInfo?.value?.trim().toLowerCase();

            const emailVerified =
                emailInfo?.verified === true ||
                profile._json?.email_verified === true ||
                profile._json?.verified_email === true;

            if(!email || !emailVerified) {
                await client.query("ROLLBACK");
                return done(null, false, {
                    message: "Google did not provide a verified email."
                });
            }

            //Do not automatically link an exiating local account with the same email to a Google account. Instead, prompt the user to sign in with their existing credentials.
            const existingUser = await client.query(
                "SELECT id FROM users WHERE email = $1",
                [email]
            )
            if(existingUser.rows.length > 0) {
                await client.query("ROLLBACK");
                return done(null, false, {
                    message: "An account with this email already exists. Sign in with your password."
                });
            }

            //Create a google account for the user if they don't already have one
            const newUser = await client.query(
                `INSERT INTO users (name, email, password_hash)
                    VALUES ($1, $2, NULL)
                    RETURNING id`,
                [profile.displayName || "MyBlog User", email]
            );
            const userId = newUser.rows[0].id;

            //connect the new user to their google account in the auth_accounts table
            await client.query(
                `INSERT INTO auth_accounts
                    (user_id, provider, provider_user_id)
                    VALUES ($1, $2, $3)`,
                [userId, "google", profile.id]
            );
            await client.query("COMMIT");
            return done(null, userId);

        } catch(error) {
            await client.query("ROLLBACK").catch(console.error);
            return done(error);
        } finally {
            client.release();
        }
    })
);

export default passport;