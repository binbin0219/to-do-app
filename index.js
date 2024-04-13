import express from "express"
import bodyParser from "body-parser"
import pg from "pg"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import cookieParser from "cookie-parser"

const app = express();
const port = process.env.PORT || 3000;
const jwtSecret = '1283fc47b7cd439a7f8e36e614a41fe519be35088befd42bc2fdf7130a646e9a75685a';
var user = [];
var tasks = [];

const db = new pg.Client({
    connectionString: "postgres://my_blog_website_user:WRAmhlA7uuwc7n71YIz3mz0imaPD65Cw@dpg-cobasda1hbls73app2og-a.singapore-postgres.render.com/my_blog_website",
    ssl: {
        rejectUnauthorized: false // For self-signed certificates (optional)
    }
});
db.connect()
.then(()=> {console.log("database connected")})
.catch((error)=> {console.log(error)})

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(cookieParser());

app.get('/login', async (req, res) => {
    res.render("login.ejs");
});

app.get('/sign-up', async (req, res) => {
    res.render("sign-up-page.ejs");
})


// Initial_Page
app.get('/', async (req, res) => {  
    const token = req.cookies.jwt;
    
    if(token){
        jwt.verify(token, jwtSecret, async (err, decodedToken)=> {
            (err)
            ?
            res.status(401).json({message: "user not authorized!"})
            :
            user = await db.query("SELECT * FROM users WHERE user_id = $1", [decodedToken.userid]);
            tasks = await db.query("SELECT * FROM tasks WHERE user_id = $1", [decodedToken.userid]);
            res.render("todo.ejs", {
                user: user.rows[0],
                tasks: tasks.rows
            });
        })
    } else {
        res.redirect('/login');
    }
});

//handlers for sign up
app.post("/signing-up", async (req, res) => {
    const users = await db.query("SELECT * FROM users");
    const hashedPassword = await bcrypt.hash(req.body.Password,10);    

    await db.query("INSERT INTO users VALUES ($1,$2,$3) RETURNING *",
        [users.rows[0] ? users.rows[users.rows.length - 1].user_id + 1 : 1, req.body.Username, hashedPassword])
        .then((insertedRow)=> {
            const maxAge = 3 * 60 * 60;
            const token = jwt.sign(
                {userid: insertedRow.rows[0].user_id, username: insertedRow.rows[0].username},
                jwtSecret,
                {expiresIn: maxAge}
            );
            res.cookie("jwt", token, {
                httpOnly: true,
                maxAge: maxAge * 1000,
            });
        })

    res.render('sign-up-successful.ejs');
})

app.post("/verify-username", async (req, res) => {
    const foundUser = await db.query("SELECT * FROM users WHERE username = $1", [req.body.username])
    if (foundUser.rows[0]) { res.json({ isUserAlreadyExisted: true }); console.log("user existed") } else { res.json({ isUserAlreadyExisted: false }); console.log("user not exist") }
})

app.post("/verify-password", async (req, res) => {
    const foundPassword = await db.query("SELECT password FROM users WHERE username = $1", [req.body.username]);

    if (foundPassword.rows[0]) {//check if the coresponding user's password in database is found or not

        bcrypt.compare(req.body.password,foundPassword.rows[0].password).then((result)=> {
            result
            ?
            res.json({ isPasswordCorrect: true }) //password correct
            :
            res.json({ isPasswordCorrect: false })// password incorrect
        })
        
    } else {
        res.json({ isPasswordCorrect: false }) //user not found
    }


})

//handlers for login
app.post('/logging-in', async (req, res) => {
    await db.query("SELECT * FROM users WHERE username = $1",[req.body.Username])
    .then((foundUser) => {
        const maxAge = 3 * 60 * 60;
        const token = jwt.sign(
            {userid: foundUser.rows[0].user_id, username: foundUser.rows[0].username},
            jwtSecret,
            {expiresIn: maxAge}
        );
        res.cookie("jwt", token, {
            httpOnly: true,
            maxAge: maxAge * 1000,
        });
    })

    res.redirect('/');
})

//handlers for to do app
app.post('/edit', async (req, res) => {

    await db.query("UPDATE tasks SET title = $1 WHERE task_id = $2", [
        req.body.updatedTask === "" ? "Untitled Task" : req.body.updatedTask, 
        req.body.taskId
    ]);

    res.redirect('/');
});

app.post('/add', async (req, res) => {

    var result = await db.query("SELECT task_id FROM tasks");

    await db.query("INSERT INTO tasks VALUES ($1,$2,$3)", [
        result.rows[0] ? result.rows[result.rows.length - 1].task_id + 1 : 1,
        req.body.userId,
        req.body.newTaskContent === "" ? "Untitled Task" : req.body.newTaskContent, 
    ]);

    res.redirect('/');
})

app.post('/delete', async (req, res) => {
    await db.query("DELETE FROM tasks WHERE task_id = $1", [req.body.taskId]);
    res.redirect('/');
})

app.listen(port, () => {
    console.log("listening on port" + port);
});