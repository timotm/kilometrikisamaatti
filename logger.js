#!/usr/bin/env node

const dbString = process.env.DATABASE_URL || "postgres://localhost/kilometrikisamaatti"
const database = require('./database')(dbString)
const Promise = require('bluebird')
const _ = require('lodash')
const moment = require('moment')
const requestAsync = Promise.promisify(require('request').defaults({strictSSL: false}))
const kmapi = require('./kmapi')

const daysAgo = process.argv[2] || 1
const login = process.argv[3] || undefined

console.log('Using date', yesterMoment().start.format('YYYY-MM-DD'))

if (login) {
  database.getTokensForLoginAsync(login).then(saveMileageForLogins)
} else {
  database.getAllTokensAsync().then(saveMileageForLogins)
}

function saveMileageForLogins(logins) {
  return Promise.join(
    Promise.all(_(logins).filter(hasStravaToken).map(saveStravaMileageForLogin).value()),
    Promise.all(_(logins).filter(hasMovesToken).map(saveMovesMileageForLogin).value())
  )
    .then(() => process.exit(0))
}

function hasStravaToken(login) {
  return login.strava_accesstoken !== null
}

function hasMovesToken(login) {
  return login.moves_accesstoken !== null
}

function yesterMoment() {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0)
  d.setMinutes(0)
  d.setSeconds(0)

  const yesterdayStart = moment(d).utcOffset(3 * 60)
  const yesterdayEnd = yesterdayStart.clone().add(1, 'days')

  return { start: yesterdayStart, end: yesterdayEnd }
}

function saveStravaMileageForLogin(login) {
  const yesterday = yesterMoment()

  return requestAsync({uri: 'https://www.strava.com/api/v3/athlete/activities?after='+ yesterday.start.format('X'),
                       headers: {
                         'Authorization': 'Bearer ' + login.strava_accesstoken
                       }
                      })
    .spread(function (res, body) {
      return _(JSON.parse(body)).filter(activityIsRideFromYesterday).reduce(function (acc, ride) {
        return acc + ride.distance / 1000
      }, 0)
    })
    .then(function (total) {
      total = total.toFixed(2)
      if (total > 0) {
        console.log('Strava:', login.kk_login, 'cycled', total, 'kms')
        return kmapi.doKmKisaPostKmForDate(login.kk_login, login.kk_passwd, yesterday.start.format('YYYY-MM-DD'), total)
      }
      else {
        console.log('Strava:', login.kk_login, 'did not cycle')
      }
    })

  function activityIsRideFromYesterday(activity) {
    const start = moment(activity.start_date)
    return activity.type === 'Ride' && start.isBefore(yesterday.end)
  }
}

function saveMovesMileageForLogin(login) {
  const yesterday = yesterMoment()

  return requestAsync({uri: 'https://api.moves-app.com/api/1.1/user/summary/daily/'+ yesterday.start.format('YYYY-MM-DD') + '?timeZone=Europe/Helsinki',
                       headers: {
                         'Authorization': 'Bearer ' + login.moves_accesstoken
                       }
                      })
    .spread(function (res, body) {
      var summary = _(JSON.parse(body)).first().summary
      var distance = _(summary).where({ 'activity': 'cycling' }).pluck('distance')
      distance = (distance / 1000).toFixed(2)
      if (distance > 0) {
        console.log('Moves:', login.kk_login, 'cycled', distance, 'kms')
        return kmapi.doKmKisaPostKmForDate(login.kk_login, login.kk_passwd, yesterday.start.format('YYYY-MM-DD'), distance)
      }
      else {
        console.log('Moves:', login.kk_login, 'did not cycle')
      }
    })
    .catch(e => {
      console.log('MOVES ERROR', login.kk_login, e)
    })
}
