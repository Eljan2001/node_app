require('dotenv').config();
const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
// passport-local
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
var PORT = process.env.PORT || 30000;
var current_user = '';
var usernm = "";

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://localhost:27017/usersDB');

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    contactList: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});
passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    })
});

passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/chatting_page",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
        current_user = profile.name.givenName;
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
        });
    }
));
app.get('/', function (req, res) {
    res.render('home');
});

app.get('/auth/google', 
    passport.authenticate('google', { scope: ["profile"] })
);

app.get('/auth/google/chatting_page', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/chatting_page');
  });

app.get('/register', function (req, res) {
    res.render('register');
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.get('/submit', function (req, res) {
    res.render('submit');
});

app.get('/chatting_page', function (req, res) {
    var usrnme="";
    for (var i=0;i<current_user.length;i++){
        if (current_user[i]=="@"){
            current_user=usrnme;
            break;
        }
        usrnme+=current_user[i];
    }
    if (req.isAuthenticated()) {
        var t = User.find({'username': current_user}, function(err,users){
            res.render('index.ejs', {username: current_user});
        })
    } else {
        res.redirect('/login');
    }
});

app.get('/logout', function (req, res) {
    res.logout();
    current_user = "";
    res.redirect("/");
})



io.sockets.on('connection', function(socket) {
    socket.on('username', function(username) {
        var usrnme="";
        for (var i=0;i<current_user.length;i++){
            if (current_user[i]=="@"){
                current_user=usrnme;
                break;
            }
            usrnme+=current_user[i];
        }
        socket.username = current_user;
        usernm = current_user;
        io.emit('is_online', '🔵 <i>' + socket.username + ' join the chat..</i>');
    });
    socket.on('disconnect', function(username) {
        io.emit('is_online', '🔴 <i>' + socket.username + ' left the chat..</i>');
    });
    socket.on('chat_message', function(message) {
        if (!message==''){
            io.emit('chat_message', '<strong>' + socket.username + '</strong>: ' + message,socket.username);
        }
    });
    socket.on('add_contact', function(contact){
        var arr=[];
        
        User.updateOne({username: current_user},{contactList: contact});
        User.find({'username':current_user}, (err,user)=>{
            console.log(user)
        })
    });
});

app.post('/register', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;

    User.register({username: username}, password, function (err, user) {
        if (err) { 
            console.log(err);
            res.redirect('/register');
        } else {
            passport.authenticate("local")(req, res, function () {
                current_user = username;
                res.redirect('/chatting_page');
            })
        }
    })
});

app.post('/login', function (req, res) {
    const username = req.body.username;
    const password = req.body.password;

    const user = new User({
        username: username,
        password: password
    });

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            current_user = username;
            
            passport.authenticate('local')(req, res, function () {
                // var t = User.find({'username': username}, function(err,users){
                //     console.log(users[0].contactList);
                // });
                
                res.redirect("/chatting_page");
                
            });
        }
    })
});

http.listen(PORT, function () {
    console.log(`Server started on port ${PORT}`);
});
