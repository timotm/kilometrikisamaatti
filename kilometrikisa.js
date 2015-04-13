var express = require('express')
var logger = require('morgan')
var bodyParser = require('body-parser')
var Promise = require('bluebird')
var using = Promise.using
var requestAsync = Promise.promisify(require('request').defaults({strictSSL: false}))
var util = require('util')
var passport = require('passport')
var StravaStrategy = require('passport-strava').Strategy
var MovesStrategy = require('passport-moves').Strategy
var pg = require('pg')
var session = require('express-session')
var pgSession = require('connect-pg-simple')(session)
var _ = require('lodash')
var Cookie = require('tough-cookie').Cookie
var dbString = process.env.DATABASE_URL || "postgres://localhost/kilometrikisamaatti"
var database = require('./database')(dbString)


function HttpError(status, msg) {
  var ret = new Error(msg)
  ret.status = status
  return ret
}

passport.use(new StravaStrategy(
  {
    clientID: '5465',
    clientSecret: process.env.STRAVA_KLIENT_SEKRET,
    callbackURL: 'http://localhost:9876/auth/strava/callback', //'http://import-kilometrikisa.herokuapp.com/auth/strava/callback',
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

passport.use(new MovesStrategy(
  {
    clientID: 'L7RMtCDn2DiS1EEJiE75WjwLdKdlJu_U',
    clientSecret: process.env.MOVES_KLIENT_SEKRET,
    callbackURL: 'http://localhost:9876/auth/moves/callback', //'http://import-kilometrikisa.herokuapp.com/auth/moves/callback',
    passReqToCallback: true
  },
  function (req, accessToken, refreshToken, profile, done) {
    req.session.movesAccessToken = accessToken
    return database.saveMovesAccessTokenAsync(req.session.user, accessToken)
      .then(function () {
        done(null, profile)
      })
  }
))

passport.serializeUser(function (user, done) {
  done(null, user.id)
})

var app = express()
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
var movesOpts = _.assign({scope: ['activity']}, redirections)

app.get('/auth/strava', passport.authenticate('strava', stravaOpts))
app.get('/auth/strava/callback', passport.authenticate('strava', stravaOpts))
app.get('/auth/moves', passport.authenticate('moves', movesOpts))
app.get('/auth/moves/callback', passport.authenticate('moves', movesOpts))

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
    .then(doKmKisaLogin)
    .then(saveCredentials(req.body.username, req.body.password))
    .then(function (username) {
      req.session.user = username
      return res.json({user: username})
    })
    .catch(function (e) {
      return next(e)
    })

  function doKmKisaLogin(creds) {
    if (!creds || !creds.hasOwnProperty('username')) throw new HttpError(400, "username missing")
    if (!creds.hasOwnProperty('password')) throw new HttpError(400, "password missing")

    var cookieJar = requestAsync.jar()
    return requestAsync({uri: 'https://www.kilometrikisa.fi/accounts/login/', jar: cookieJar})
      .spread(getCsrfTokenCookie)
      .then(function (csrftoken) {
        return postLogin(csrftoken, creds.username, creds.password, cookieJar)
      })
      .spread(getSessionIdCookie)
      .then(function (sessionid) {
        if (sessionid === undefined) {
          throw new HttpError(401, "Tarkista käyttäjätunnus ja/tai salasana")
        }
        return creds.username
      })

    function postLogin(csrftoken, username, password, cookieJar) {
      return requestAsync({ method: 'POST',
                            headers: { 'Referer': 'https://www.kilometrikisa.fi/accounts/login/' },
                            jar: cookieJar,
                            uri: 'https://www.kilometrikisa.fi/accounts/login/',
                            form: { csrfmiddlewaretoken: csrftoken,
                                    username: username,
                                    password: password }
                          })
    }

    function getCsrfTokenCookie(res, body) {
      return getCookieFromRes(res, 'csrftoken')
    }

    function getSessionIdCookie(res, body) {
      return getCookieFromRes(res, 'sessionid')
    }

    function getCookieFromRes(res, cookiename) {
      if (res.headers['set-cookie'] instanceof Array)
        cookies = res.headers['set-cookie'].map(function (c) { return (Cookie.parse(c)) })
      else
        cookies = [Cookie.parse(res.headers['set-cookie'])]

      cookie = _.find(cookies, { 'key': cookiename})
      return cookie ? cookie.value : undefined
    }
  }
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
