var express                 = require('express');
var app                     = express();
var flash                   = require("connect-flash");
var bodyParser              = require('body-parser');
var mongoose                = require('mongoose');
var passport                = require('passport');
var LocalStrategy           = require('passport-local');
var passportLocalMongoose   = require('passport-local-mongoose');
var methodOverride          = require('method-override');


var campgroundSchema = new mongoose.Schema({
    name: String,
    image: String,
    description: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: String
    },
    comments: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
        }
    ]
});
var UserSchema = new mongoose.Schema({
    username: String,
    password: String
});


var commentSchema = mongoose.Schema({
    text: String,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: String
    }
});

UserSchema.plugin(passportLocalMongoose);
var Comment = mongoose.model('Comment', commentSchema);
var Campground = mongoose.model('Campground', campgroundSchema);
var User = mongoose.model('User', UserSchema);


mongoose.connect('mongodb://localhost/yelpcamp');
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(methodOverride("_method"));
app.use(flash());

app.use(require("express-session")({
    secret: "Mutu is spanjel",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function (req, res, next) {
    res.locals.currentUser = req.user;
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});


//======================================================================================================================================================
app.get('/', function (req, res) {
   res.render('index');
});

app.get('/locations/:id/comments/new',isLoggedIn, function (req, res) {
    Campground.findById(req.params.id, function (err, campground) {
        if (err){
            console.log(err);
        } else{
            res.render('comments/new', {campground: campground});
        }
    });
});



app.get('/locations/new', isLoggedIn, function(req, res){
    res.render('campgrounds/new');
});

app.get('/locations', function(req, res){
    Campground.find({}, function (err, campgrounds) {
        if(err){
            console.log(err)
        } else {
            res.render('campgrounds/locations', {campgrounds: campgrounds, currentUser: req.user});
        }
    })
});


app.get("/locations/:id", function(req, res){
    Campground.findById(req.params.id).populate('comments').exec(function (err, foundCampground) {
        if(err){
            console.log(err);
        } else {
            console.log(foundCampground);
            res.render('campgrounds/show', {campground: foundCampground});
        }
    });
});



app.post('/locations',isLoggedIn, function(req, res){
    var name = req.body.name;
    var image = req.body.image;
    var author = req.body.author;
    var description = req.body.description;
    var author      = {
        id: req.user._id,
        username: req.user.username
    };
    var newLocation = {name: name, image: image, description: description, author: author};
    Campground.create(newLocation, function (err, newlyCreated) {
        if(err){
            console.log(err)
        } else {
            req.flash("success", "New Image Successfully added.");
            res.redirect('/locations');
        }
    });
});

//===========================================================
// APp route for posting new comment
//===========================================================
app.post("/locations/:id/comments",isLoggedIn, function(req, res){
    Campground.findById(req.params.id, function(err, campground){
        if(err){
            req.flash("error", "Something went wrong.");
            console.log(err);
            res.redirect("/locations");
        } else {
            Comment.create(req.body.comment, function(err, comment){
                if(err){
                    console.log(err);
                } else {
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    comment.save();
                    campground.comments.push(comment._id);
                    campground.save();
                    req.flash("success", "New commment created.");
                    res.redirect('/locations/' + campground._id);
                }
            });
        }
    });
});

//===========================================================
// Show register form.
//===========================================================
app.get('/register', function (req, res) {
    res.render('register')
});
// Handle Sign Up Logic
app.post('/register', function (req, res) {
    var newUser = new User({username: req.body.username});
    User.register(newUser, req.body.password, function (err, user) {
        if(err){
            req.flash("error", err.message);
            return res.render('register');
        } else {
            passport.authenticate("local")(req, res, function () {
                req.flash("success", "Welcome to the homepage " + user.us);
                res.redirect("/locations");
            })
        }
    });
});


//===========================================================
// Show login form.
//===========================================================
app.get('/login', function (req, res) {
    res.render('login', {message: req.flash("error")});
});
//Handle sign in logic
app.post('/login', passport.authenticate('local', {successRedirect: "/locations", failureRedirect: "/login"}), function (req, res) {
});


app.get('/logout', function (req, res) {
    req.logout();
    req.flash("success", "Logged out!");
    res.redirect('/locations');
});

app.get("/locations/:id/edit", checkCampgroundOwnership, function (req, res) {
    Campground.findById(req.params.id, function(err, foundCampground) {
        if(err){
            req.flash("error", "Something went wrong.");
            res.redirect("/locations");
        }else {
            req.flash("success", "You image is successfully updated.");
            res.render("campgrounds/edit", {campground: foundCampground});
        }
    });
});

app.put("/locations/:id",checkCampgroundOwnership, function (req, res) {
    Campground.findByIdAndUpdate(req.params.id, req.body.campground, function(err, updatedCampground) {
        if (err){
            res.redirect('/locations');
        } else {
            res.redirect("/locations/" + req.params.id);
        }
    });
});

app.delete("/locations/:id", function (req, res) {
    Campground.findByIdAndRemove(req.params.id, function (err) {
        if(err){
            res.redirect('/locations');
        } else {
            req.flash("success", "Campground Successfully removed.");
            res.redirect('/locations');
        }
    })
});

app.get('/locations/:id/comments/:comment_id/edit', function (req, res) {
    Comment.findById(req.params.comment_id, function (err, foundComment) {
        if (err){
            res.redirect("back");
        } else {
            res.render("comments/edit", {campground: req.params.id, comment: foundComment});
        }
    });
});

app.put("/locations/:id/comments/:comment_id", function (req, res) {
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function (err, updatedComment) {
        if(err){
             res.redirect("back");
        } else {
            res.redirect("/locations/" + req.params.id);
        }
    });
});

app.delete("/locations/:id/comments/:comment_id", function (req, res) {
    Comment.findByIdAndRemove(req.params.comment_id, req.body.comment, function(err, updatedComment){
        if(err){
            res.redirect("back");
        } else {
            req.flash("success", "Comment Deleted.");
            res.redirect("/locations/" + req.params.id);
        }
    });
});

function isLoggedIn(req, res, next) {
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You need to be logged in to do that.");
    res.redirect("/login");
}

function checkCampgroundOwnership(req, res, next) {
    if(req.isAuthenticated()){
        Campground.findById(req.params.id, function(err, foundCampground){
            if(err){
                req.flash("error", "Campground not found");
                res.redirect("back");
            }  else {
                if (!foundCampground) {
                    req.flash("error", "Item not found.");
                    return res.redirect("back");
                }
                if(foundCampground.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You do not have permission to do that.");
                    res.redirect("back");
                }
            }
        });
    } else {
        res.redirect("back");
    }
}

app.listen(3000, function () {
        console.log('===========================');
        console.log('Server Started');
        console.log('===========================');
});
