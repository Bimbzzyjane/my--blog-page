import express from "express";

const app= express();
const port = 3000;

app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));


// Temporary storage for our blog posts
let posts = [
    {
        id: Date.now(),
        title: "My First Blog Post",
        content: "Welcome to my blog website. This is my first post where I'll be sharing my thoughts and ideas with everyone.",
        date: "August 26, 2026",
    },
    {
        id: Date.now() + 1,
        title: "Learning Web Development",
        content: "I'm currently at the backend courses learning about using node, express and Ejs to create the server side of my website.",
        date: "August 27, 2026",

    }
    
];
//console.log('id', posts[0].id, posts[1].id);


//Home Page
app.get("/", (req, res) => {
    res.render("index.ejs", {posts: posts});

});

// Create post page
app.get("/posts/new", (req, res) => {
    res.render("new-post.ejs");
});

//About page
app.get("/about", (req, res) => {
    res.render("about.ejs");
});

//// Create a new post
app.post("/post", (req, res)=> {
    const newPost = {
        id: Date.now(), 
        title: req.body.title,
        content: req.body.content,
        date: new Date().toLocaleDateString("en-US", {month: "long", day: "numeric", year: "numeric"}),
    }
    posts.push(newPost);
    res.redirect("/");
})

//Edit post page
app.get("/posts/:id/edit", (req, res) => {

    const id = Number(req.params.id);

    const post = posts.find(post => post.id === id);

    res.render("edit-post.ejs", {
        post: post
    });
    

});

//Update a post
app.post("/posts/:id/edit", (req, res) => {

    const id = Number(req.params.id);

    const post = posts.find(post => post.id === id);

    post.title = req.body.title;
    post.content = req.body.content;

    res.redirect("/");

});

//Delete a post
app.post("/posts/:id/delete", (req, res) => {

    const id = Number(req.params.id);

    posts = posts.filter(post => post.id !== id);

    res.redirect("/");

});

//Start the server
app.listen(port, function (){
    console.log(`Server running on port ${port}`)
});