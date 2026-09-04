import express from "express";
import bodyParser from "body-parser";

const app= express();
const port = 3000;

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

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

app.get("/", (req, res) => {
    res.render("index.ejs", {posts: posts});

});

app.get("/posts/new", (req, res) => {
    res.render("new-post.ejs");
});

app.get("/about", (req, res) => {
    res.render("about.ejs");
});

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

app.get("/posts/:id/edit", (req, res) => {

    const id = Number(req.params.id);

    const post = posts.find(post => post.id === id);

    res.render("edit-post.ejs", {
        post: post
    });
    

});

app.post("/posts/:id/edit", (req, res) => {

    const id = Number(req.params.id);

    const post = posts.find(post => post.id === id);

    post.title = req.body.title;
    post.content = req.body.content;

    res.redirect("/");

});

app.post("/posts/:id/delete", (req, res) => {

    const id = Number(req.params.id);

    posts = posts.filter(post => post.id !== id);

    res.redirect("/");

});

app.listen(3000, function (){
    console.log(`Server running on port ${port}`)
});