//import "dotenv/config";

import express from "express";
import db from "./db/db.js";
import bcrypt from "bcrypt";
import session from "express-session"; //To manage user sessions
import connectPgSimple from "connect-pg-simple"; // For session store in PostgreSQL
import passport from "./auth/google.js"; // Import the passport configuration for Google OAuth

const app= express();
const port = process.env.PORT || 3000;
const saltRounds = 12;
const pgSession = connectPgSimple(session); //Connect session to PostgreSQL

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

//configure session middleware
app.use(session({
    store: new pgSession({
        pool: db,
        createTableIfMissing: true, 
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,    //avoid resaving session if it hasn't been modified
    saveUninitialized: false,    //avoid storing empty sessions
    cookie: {
        httpOnly: true,    //prevent client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === "production", //ensure cookies are only sent over HTTPS in production
        sameSite: "lax",    //helps reduce cross-site request forgery (CSRF) attacks
        maxAge: 1000 * 60 * 60 * 24,
    }
}));

app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));
//initialize passport
app.use(passport.initialize());

//create a middleware to make the user object available in all templates
app.use(async(req, res, next) => {
    res.locals.user = null;
    
    if(!req.session.userId) {
        return next();
    }

    try{
        const result = await db.query(
            "SELECT id, name, email FROM users WHERE id= $1",
            [req.session.userId]
        )

        if(result.rows.length > 0) {
            res.locals.user = result.rows[0];

            console.log(result.rows[0]);
            next();
        }
    } catch(error) {
        console.error("Error retreiving logged-in user:", error);
        next(error);
    }
});

function requireAuth(req, res, next) {
    if(!res.locals.user) {
        return res.redirect("/login");
    }
    next();
};

//Test session route to check if the session is working
app.get("/test-session", (req, res) => {
    console.log("Session user ID:", req.session.userId);
    res.json({
        loggedIn: Boolean(req.session.userId)
    });
});

//Home Page
app.get("/", async (req, res) => {

    try {
        const result = await db.query(`
            SELECT
                posts.*,
                users.name AS author_name
            FROM posts
            JOIN users ON posts.user_id = users.id
            ORDER BY posts.created_at DESC, posts.id DESC
        `);
        const posts = result.rows;
        console.log(posts);
        res.render("index.ejs", {
        posts: posts,
    });
    } catch(error) {
        console.error("Error fetching posts from the database:", error);
        res.status(500).send("Unable to retrieve posts")
    }
});

// Display posts belonging to the logged-in user
app.get("/my-posts", requireAuth, async (req, res) => {
    const userId = res.locals.user.id;

    try {
        const result = await db.query(
            `SELECT posts.*, users.name AS author_name
             FROM posts
             JOIN users ON posts.user_id = users.id
             WHERE posts.user_id = $1
             ORDER BY posts.created_at DESC, posts.id DESC`,
            [userId]
        );

        return res.render("my-posts.ejs", {
            posts: result.rows
        });

    } catch (error) {
        console.error("Unable to retrieve user's posts:", error);
        return res.status(500).send("Unable to retrieve your posts");
    }
});

// Create post page
app.get("/posts/new", requireAuth, (req, res) => {
    res.render("new-post.ejs");
});

//About page
app.get("/about", (req, res) => {
    res.render("about.ejs");
});

//Register page
app.get("/register", (req, res) => {
    res.render("register.ejs" /*,{
        user: user,
    }*/);
});

//Login Page
app.get("/login", (req, res) => {
    res.render("login.ejs");
});

//Register a new user
app.post("/register", async (req, res) => {
    const {name, email, password, confirmPassword} = req.body;
    const errors = [];

    //validate the form
    if(!name || !name.trim()){
        errors.push("Full name is required");
    };
    if(!email || !email.trim()){
        errors.push("Email address is required");
    };
    if(!password || password.length < 8){
        errors.push("Password must contain at least 8 characters");
    };
    if(password !== confirmPassword){
        errors.push("Passwords do not match");
    };

    //return validation errors to the registration page
    if(errors.length > 0){
        return res.status(400).render("register.ejs", {
            errors: errors,
            values: {
                name,
                email
            }
        });
    }

    try{
        //Trim and convert email to lowercase for consistency
        const trimmedEmail = email.trim().toLowerCase();

        //Check if the email already exists in the database
        const verifyExistingEmail = await db.query(
            "SELECT id FROM users WHERE email = $1",
            [trimmedEmail]
        );
        //If email exists, return an error message on the registration page
        if(verifyExistingEmail.rows.length > 0){
            return res.status(409).render("register.ejs", {
                error: "Email already exist. Please log in.",
                values: {
                    name: name,
                    email: email,
                }
            });
            
        }
        //Hash the password and store the user in the database
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        await db.query(
            "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
            [name.trim(), trimmedEmail, hashedPassword]
        );
        res.redirect("/login")
        
    } catch (error) {
        //Handle unique constraint violation for email. 23505 is the error code for unique violation in PostgreSQL
        //for example, if two users try to register with the same email at the same time, this error will be thrown
        
        if (error.code === "23505") {
            return res.status(409).render("register.ejs", {
                error: "Email already exists. Please log in.",
                values: { name, email }
            });
        }
        console.log("Registration failed", error);
        res.status(500).render("register.ejs", {
            error: "Something went wrong. Please try again later.",
            values: {name, email}
        });
    }
});

//Login a user
app.post("/login", async (req, res) => {
    const {email, password} = req.body;

    //validate the form and return errors if true
    if(!email || !email.trim() || !password){
        return res.status(400).render("login.ejs", {
            error: "Email and Password are required",
            values: {email}
        });
    };

    try{
        const trimmedEmail = email.trim().toLowerCase();
        const result = await db.query(
            "SELECT * FROM users WHERE email = $1",
            [trimmedEmail]
        );


        if (result.rows.length === 0) {
            return res.status(404).render("login.ejs", {
                error: "Invalid email",
                values: {email}
            });
        };
        const user = result.rows[0];
        const storedPassword = user.password_hash;

        if(!storedPassword){
            return res.status(404).render("login.ejs", {
                error: "Invalid email or password. Please try again",
                values: {email}
            });
        }

        const comparePassword = await bcrypt.compare(
            password, storedPassword
        );

        if(!comparePassword){
            return res.status(404).render("login.ejs", {
                error: "Password is incorrect. Please try again",
                values: {email}
            });
        }
        
        req.session.regenerate((err) => {
            if (err) {
                console.error("Session creation failed:", err);

                return res.status(500).render("login.ejs", {
                    error: "Unable to sign in. Please try again.",
                    values: { email }
                });
            }

            req.session.userId = user.id;

            req.session.save((err) => {
                if (err) {
                    console.error("Session save failed:", err);

                    return res.status(500).render("login.ejs", {
                        error: "Unable to sign in. Please try again.",
                        values: { email }
                    });
                }

                return res.redirect("/");
            });
        });
        
    } catch(error) {
        console.log("Login failed", error);
        res.status(500).render("login.ejs", {
            error: "Something went wrong. Please try again later.",
            values: {email}
        });
    }
});

//// Create a new post
app.post("/post",requireAuth, async (req, res)=> {
    const { title, content } = req.body;
    const userId = res.locals.user.id;

    if(!title?.trim() || !content?.trim()) {
        return res.status(400).send("Title and content are required")
    }

    try{       
        await db.query(
            "INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3)",
            [userId, title, content]
        )
        res.redirect("/");
        
    } catch(error) {
        console.error("Post creation failed:", error);
        res.status(500).send("Unable to create post");
    }
});

//Edit post page
app.get("/posts/:id/edit", requireAuth,async (req, res) => {
    const postId = Number(req.params.id);
    const userId = res.locals.user.id;

    if (!Number.isSafeInteger(postId) || postId <= 0) {
        return res.status(400).send("Invalid post ID");
    }

    try{
        //Select the id of the post clicked for editing
        const result = await db.query("SELECT * FROM posts WHERE id = $1 AND user_id = $2",
            [postId, userId]
        );
        //To check if post exists and it matches the user logged in
        if (result.rows.length === 0) {
            return res.status(404).send("Post not found");
        };
        //save the object in post
        const post = result.rows[0];

        res.render("edit-post.ejs", {
            post: post,
        });
    } catch(error){
        console.error("Post retreival failed:", error);
        res.status(500).send("Unable to retrieve post");
    }
});

//Update a post
app.post("/posts/:id/edit", requireAuth, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = res.locals.user.id;
    const {title, content} = req.body;

    if(!Number.isSafeInteger(postId) || postId <= 0) {
        return res.status(400).send("Invalid post ID");
    }

    if(!title?.trim() || !content?.trim()) {
        return res.status(400).send("Title and content are required");
    }

    try{       
        const result = await db.query(
            `UPDATE posts SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3 AND user_id = $4 RETURNING id`,
            [title.trim(), content.trim(), postId, userId]
        );
        //checks if the row exists, if it does not, 404 error
        if(result.rows.length === 0){
            res.status(404).send("post not found");
        }
        res.redirect("/");    
    } catch(error){
        console.error("Error updating post:", error);
        res.status(500).send("Unable to update post");
    }
});

//Delete a post
app.post("/posts/:id/delete",requireAuth, async (req, res) => {
    const postId = Number(req.params.id);
    const userId = res.locals.user.id;

    if (!Number.isSafeInteger(postId) || postId <= 0) {
        return res.status(400).send("Invalid post ID");
    }

    try{
        const result= await db.query("DELETE FROM posts WHERE id = $1 AND user_id = $2",
            [postId, userId]
        )
        if(result.rowCount === 0){
            return res.status(404).send("Post was not found")
        }
        res.redirect("/");
    } catch(error){
        console.log("Cannot delete post:", error);
        res.status(500).send("Post could not be deleted.")
    }
    

});

app.post("/logout", (req, res, next) =>{
    //destroy the session and clear the cookie
    req.session.destroy((err) => {
        if(err) {
            console.log("Logout failed:", err);
            return next(err);
        }
        //clear the session cookie from the browser
        //connect.sid is the default name for the session cookie in express-session
        res.clearCookie("connect.sid")
        res.redirect("/");
    })
});

//Google OAuth routes for when a user clicks the "Sign in with Google" button. This will redirect the user to Google's OAuth 2.0 server for authentication.
app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false
    })
);

//handle the callback from Google after the user has authenticated. This route will be called by Google after the user has granted or denied permission.
app.get("/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", {session: false}, (err, userId, info) => {
        if (err) {
            console.error("Google authentication failed:", err);
            return res.status(500).render("login.ejs", {
                error: "Google sign-in failed. Please try later."
            });
        }
        if(!userId) {
            return res.status(401).render("login.ejs", {
                error: info?.message || "Google sign-in was unsuccessful."
            });
        }

        //Reuse the existing express session system
        req.session.regenerate((sessionError) => {
            if (sessionError) {
                return next(sessionError);
            }

            req.session.userId = userId;

            req.session.save((saveError) => {
                if (saveError) {
                    return next(saveError);
                }

                return res.redirect("/");
            });
        });
        
    })(req, res, next);
});

//Start the server
app.listen(port, function (){
    console.log(`Server running on port ${port}`)
});