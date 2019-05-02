const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')
const Promise = require('bluebird')
const util = require('util')
const passport = require('passport')
const pg = require('pg')
const session = require('express-session')
const pgSession = require('connect-pg-simple')(session)
const _ = require('lodash')
const database = require('./database')()
const kmapi = require('./kmapi')
const stravaStrategy = require('./strava')
const refresh = require('passport-oauth2-refresh')

passport.use(stravaStrategy)
refresh.use(stravaStrategy)

passport.serializeUser(function(user, done) {
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
app.use(
  session({
    store: new pgSession({
      pg: pg,
      conString: database.dbString
    }),
    secret: process.env.SESSION_SEKRET,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    resave: true,
    saveUninitialized: false
  })
)

var redirections = { successRedirect: '/', failureRedirect: '/' }
var stravaOpts = _.assign({ scope: 'activity:read_all' }, redirections)

app.get('/auth/strava', passport.authenticate('strava', stravaOpts))
app.get('/auth/strava/callback', passport.authenticate('strava', stravaOpts))

app.get('/rest/userinfo', function(req, res) {
  util.log('/rest/userinfo ' + (req.session.hasOwnProperty('user') ? req.session.user : '[nil]'))
  var ret = { user: req.session.user }

  database.getAccessTokensAsync(req.session.user).then(function(tokens) {
    _.assign(ret, tokens)
    res.json(ret)
  })
})

app.post('/rest/login', function(req, res, next) {
  util.log('/rest/login')
  delete req.session.user

  Promise.resolve(req.body)
    .then(kmapi.doKmKisaLogin)
    .then(saveCredentials(req.body.username, req.body.password))
    .then(function(username) {
      req.session.user = username
      return res.json({ user: username })
    })
    .catch(function(e) {
      return next(e)
    })
})

app.use(function(err, req, res, next) {
  util.log('error handling request: ' + err.stack)
  res.status(err.status || 500).end()
})

var server = app.listen(process.env.PORT || 9876, function() {
  util.log('Listening on port ' + server.address().port)
})

function saveCredentials(username, password) {
  return function() {
    return database.saveCredentialsAsync(username, password)
  }
}
