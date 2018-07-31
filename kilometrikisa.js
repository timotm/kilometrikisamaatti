var express = require('express')
var logger = require('morgan')
var bodyParser = require('body-parser')
var Promise = require('bluebird')
var util = require('util')
var passport = require('passport')
var StravaStrategy = require('passport-strava').Strategy
var pg = require('pg')
var session = require('express-session')
var pgSession = require('connect-pg-simple')(session)
var _ = require('lodash')
var dbString = process.env.DATABASE_URL || "postgres://localhost/kilometrikisamaatti"
var database = require('./database')(dbString)
var kmapi = require('./kmapi')


passport.use(new StravaStrategy(
  {
    clientID: '5465',
    clientSecret: process.env.STRAVA_KLIENT_SEKRET,
    callbackURL: process.env.NODE_ENV === 'production' ? 'https://kilometrikisamaatti.herokuapp.com/auth/strava/callback' : 'http://localhost:9876/auth/strava/callback',
    passReqToCallback: true
  },
  function (req, accessToken, refreshToken, profile, done) {
    req.session.stravaAccessToken = accessToken
    return database.saveStravaAccessTokenAsync(req.session.user, accessToken)
      .then(function () {
        done(null, profile)
      })
  }
))

passport.serializeUser(function (user, done) {
  done(null, user.id)
})

var app = express()

function forceSsl(req, res, next) {
  if (req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(['https://', req.get('Host'), req.url].join(''))
  } else {
    next()
  }
}

if (process.env.NODE_ENV === 'production') {
  app.use(forceSsl)
}

app.use(logger('dev'))
app.use(express.static(__dirname + '/www'))
app.use(bodyParser.json())
app.use(passport.initialize())
app.use(session({
  store: new pgSession({
    pg : pg,
    conString : dbString
  }),
  secret: process.env.SESSION_SEKRET,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
  resave: true,
  saveUninitialized: false
}))

var redirections = { successRedirect: '/', failureRedirect: '/' }
var stravaOpts = _.assign({scope: 'view_private'}, redirections)

app.get('/auth/strava', passport.authenticate('strava', stravaOpts))
app.get('/auth/strava/callback', passport.authenticate('strava', stravaOpts))

app.get('/rest/userinfo', function (req, res) {
  util.log("/rest/userinfo " + (req.session.hasOwnProperty('user') ? req.session.user : '[nil]'))
  var ret = {user: req.session.user}

  database.getAccessTokensAsync(req.session.user)
    .then(function (tokens) {
      _.assign(ret, tokens)
      res.json(ret)
    })
})

app.post('/rest/login', function (req, res, next) {
  util.log('/rest/login')
  delete req.session.user

  Promise.resolve(req.body)
    .then(kmapi.doKmKisaLogin)
    .then(saveCredentials(req.body.username, req.body.password))
    .then(function (username) {
      req.session.user = username
      return res.json({user: username})
    })
    .catch(function (e) {
      return next(e)
    })
})


app.use(function (err, req, res, next) {
  util.log('error handling request: ' + err.stack)
  res.status(err.status || 500).end()
})

var server = app.listen(process.env.PORT || 9876, function () {
  util.log('Listening on port ' + server.address().port)
})

function saveCredentials(username, password) {
  return function () {
    return database.saveCredentialsAsync(username, password)
  }
}
