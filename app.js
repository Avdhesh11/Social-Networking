//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const flash = require('express-flash');
const upload =require("express-fileupload");
const fetch = require("node-fetch");

const app = express();

app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({extended:true}));
app.use(flash());
app.use(upload());
app.use(session({
  secret:"Our little secret.",
  resave:false,
  saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",{ useUnifiedTopology: true ,useNewUrlParser: true});
mongoose.set("useCreateIndex",true);
const userSchema = new mongoose.Schema({
  username:String,
  email:{type:String/*,index:true,sparse:true*/},
  password:String,
  googleId:String,
  facebookId:String,
  name:{type:String,default:"New_User"},
  birthday:String,
  bio:String,
  profile_img:{type:String,default:"uploads/avatar.png"},
  post:[String]
});
 const postSchema = new mongoose.Schema({
   email1:String,
   username1:String,
   profile_img1:String,
   post1:String,
   like:[String],
   comment:[{name:String,comm:String}]

 });
var options = {
  saltlen: 32,
  iterations: 25000,
  keylen: 512,
  digestAlgorithm: 'sha256',
  interval: 100,
  usernameField: 'email',
  saltField: 'salt',
  hashField: 'hash',
  attemptsField: 'attempts',
  lastLoginField: 'last',
  selectFields: undefined,
  usernameLowerCase: false,
  populateFields: undefined,
  encoding: 'hex',
  limitAttempts: true,
  maxAttempts: 5,
};

userSchema.plugin(passportLocalMongoose,options);
userSchema.plugin(findOrCreate);
const User = mongoose.model("User",userSchema);
const Post = mongoose.model("Post",postSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/main",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({googleId: profile.id ,email:profile.emails[0].value}, function (err, user) {
      User.updateOne({email:profile.emails[0].value},{username:profile.name.givenName},function(err){
        if(err){
          console.log(err);
        }
        else{
          //console.log("success");
        }
      });
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/main"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', {successRedirect: '/main',scope:
  [ 'email', 'profile' ] }));

  app.get('/auth/google/main',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function(req, res) {
      res.redirect('/main');
    });

    app.get('/auth/facebook',
      passport.authenticate('facebook', {successRedirect: '/main',scope:
      [ 'email', 'profile' ] }));

app.get('/auth/facebook/main',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
    res.redirect('/main');
});


app.get("/login",function(req,res){
  res.render("login",{login_error:req.flash("error")});
});

app.get("/register",function(req,res){
  res.render("register",{error:req.flash("error")});
});


app.get("/main",function(req,res){
  if(req.isAuthenticated()){
    // fetch("https://pokeapi.co/api/v2/pokemon?limit=151")
    // .then(response => response.json())
    // .then(allpokemon => console.log(allpokemon.name))
   Post.find({"post1":{$ne:null}},function(err,foundUser){
     if(err){
       console.log(err);
     }
     else{
       User.find({},function(err,found2){
          if(err){
            console.log(err);
          }
          else{
            res.render("main",{userWithPost:foundUser,profileImage:req.user.profile_img,user:found2});
          }
       })

     }
   });

  }
  else{
    res.redirect("/login");
  }

});

app.get("/createpost",function(req,res){
  if(req.isAuthenticated()){
    res.render("createpost",{profileImage:req.user.profile_img});
  }
  else{
    res.redirect("/login");
  }
});

app.get("/myposts",function(req,res){
  if(req.isAuthenticated()){
   Post.find({email1:req.user.email},function(err,foundUser){
     if(err){
       console.log(err);
     }
     else{
       User.find({},function(err,found2){
          if(err){
            console.log(err);
          }
          else{
            res.render("myposts",{userWithPost:foundUser,profileImage:req.user.profile_img,user:found2});
          }
       })
     }
   });

  }
  else{
    res.redirect("/login");
  }

});

app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/login");
});

app.post("/createpost",function(req,res){
  if(req.body.userPost!==""){

    req.user.post.push(req.body.userPost);
    req.user.save();

   const new_post= new Post({
     email1:req.user.email,
     username1:req.user._id,
     profile_img1:req.user.profile_img,
     post1:req.body.userPost
   });
   new_post.save();

    res.redirect("/main");
  }
  else{
    res.redirect("/main");
  }

});

app.get("/profile",function(req,res){

  if(req.isAuthenticated()){
    res.render("profile",{name:req.user.name,username:req.user.username,dob:req.user.birthday,bio:req.user.bio,profileImage:req.user.profile_img});
  }
  else{
    res.redirect("/login");
  }
});

app.get("/postDetails",function(req,res){
  if(req.isAuthenticated()){

    User.find({},function(err,found){
       if(err){
         console.log(err);
       }
       else{
         res.render("postDetails",{profileImage:req.user.profile_img,user:found});
       }
    })
  }
  else{
    res.redirect("/login");
  }
})

app.post("/postDetails",function(req,res){
  Post.find({_id:req.body.post_detail},function(err,foundpost){
    if(err){
      console.log(err);
    }
    else{
      // console.log(foundpost);
      User.find({},function(err,found){
         if(err){
           console.log(err);
         }
         else{
           res.render("postDetails",{postwithDetials:foundpost,profileImage:req.user.profile_img,user:found});
         }
      })
    }
  });
});

app.post("/main",function(req,res){

   Post.updateOne(
    { _id:req.body.comm_post},
    { $push: { comment:{name:req.user._id,comm:req.body.comment}} },
    function(err){
      if(err){
        console.log(err);
      }
    });

   var a=0;
  Post.find({_id:req.body.like},function(err,found){
    if(err){
      console.log(err);
    }
    else{
      found.forEach(function(p){
          p.like.forEach(function(like){
            if(like==req.user._id){
              a=1;
            }
          })
      })

      if(a===0){
        Post.updateOne(
          { _id:req.body.like},
          { $push: { like:req.user._id} },
          function(err){
            if(err){
              console.log(err);
            }
          });
      }
    }
  })



  res.redirect("/main");
});

app.post("/profile",function(req,res){
  const name=req.body.name;
  const username=req.body.username;
  const birthday=req.body.dob;
  const bio=req.body.bio;
  const img=req.body.image;
  const old_name=req.user.username;
   User.updateMany({email:req.user.email},{name:name,username:username,birthday:birthday,bio:bio},function(err){
     if(err){
       console.log(err);
     }
     else{
       if(req.files){
         const file =req.files.image;
         const filename = username+".png";
        file.mv("./public/uploads/"+filename,function(err){
          if(err){
            console.log(err);
          }
          else{
           /////////////
            User.updateOne({email:req.user.email},{profile_img:"uploads/"+username+".png"},function(err){
              if(err){
                console.log(err);
              }
              else{
                // console.log("Image uploaded");
              }
            });
            Post.updateMany({email1:req.user.email},{profile_img1:"uploads/"+username+".png"},function(err){
              if(err){
                console.log(err);
              }
              else{
                // console.log("Image uploaded");
              }
            });
            ////////
          }
        })
       }

//username onchange on hone par likes and comment ke names bhi change honge vo krne h abhi
       Post.updateMany({username1:old_name},{username1:username},function(err){
         if(err){
           console.log(err);
         }
         else{
           // console.log("Image uploaded");
         }
       });

        res.redirect("/main");
     }
   })
});

app.post("/register",function(req,res){
  const username = req.body.username;
  const email = req.body.email;
  const password = req.body.password;
  const confirm_password = req.body.confirm_password;
  if(password !== confirm_password){
    res.render("register",{error:"Password Incorrect!!"});
  }
  else{
    User.register({email:email,username:username},password,function(err,user){
      if(err){
        console.log(err);
        res.render("register",{error:"User Already Exist!!"});
      }
      else{
          passport.authenticate("local",{failureRedirect:"/register"})(req,res,function(){
          const num=Math.floor(Math.random() * 890)+1;
          User.updateOne({email:req.user.email},{profile_img:"https://pokeres.bastionbot.org/images/pokemon/"+num+".png"},function(err){
            if(err){
              console.log(err);
            }
          })
          res.redirect("/profile");
        })
      }
    });
  }
});

app.post("/login",function(req,res){

  const user= new User({
    email:req.body.email,
    password:req.body.password
  });

  req.login(user,function(err){
    if(err){
      console.log(err);
      res.redirect("/login");
    }
    else{
      passport.authenticate("local",{failureRedirect:"/login",failureFlash: "Invalid Credentials!!"})(req,res,function(){
          res.redirect("/main");
      })
    }
  });
});
app.listen(3000,function(){
  console.log("server stared on port:3000");
});
