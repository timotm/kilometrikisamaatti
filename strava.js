const StravaStrategy = require('passport-strava').Strategy
const database = require('./database')()

module.exports = new StravaStrategy(
  {
    clientID: '5465',
    clientSecret: process.env.STRAVA_KLIENT_SEKRET,
    callbackURL:
      process.env.NODE_ENV === 'production'
        ? 'https://kilometrikisamaatti.herokuapp.com/auth/strava/callback'
        : 'http://localhost:9876/auth/strava/callback',
    passReqToCallback: true
  },
  (req, accessToken, refreshToken, profile, done) => {
    req.session.stravaAccessToken = accessToken
    req.session.stravaRefreshToken = refreshToken
    return database.saveStravaTokensAsync(req.session.user, accessToken, refreshToken).then(() => done(null, profile))
  }
)
