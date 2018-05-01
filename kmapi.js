const Promise = require('bluebird')
const requestAsync = Promise.promisify(require('request').defaults({strictSSL: false}))
const Cookie = require('tough-cookie').Cookie
const _ = require('lodash')

function HttpError(status, msg) {
  const ret = new Error(msg)
  ret.status = status
  return ret
}

function doKmKisaLogin(creds) {
  if (!creds || !creds.hasOwnProperty('username')) throw new HttpError(400, "username missing")
  if (!creds.hasOwnProperty('password')) throw new HttpError(400, "password missing")

  const cookieJar = requestAsync.jar()
  return requestAsync({uri: 'https://www.kilometrikisa.fi/accounts/login/', jar: cookieJar})
    .spread(getCsrfTokenCookie)
    .then(csrftoken => postLogin(csrftoken, creds.username, creds.password))
    .spread(getSessionIdCookie)
    .then(sessionid => {
      if (sessionid === undefined) {
        throw new HttpError(401, "Tarkista käyttäjätunnus ja/tai salasana")
      }
      return cookieJar
    })

  function postLogin(csrftoken, username, password) {
    return requestAsync({ method: 'POST',
                          headers: { 'Referer': 'https://www.kilometrikisa.fi/accounts/login/' },
                          jar: cookieJar,
                          uri: 'https://www.kilometrikisa.fi/accounts/login/',
                          form: { csrfmiddlewaretoken: csrftoken,
                                  username: username,
                                  password: password }
                        })
  }
}

function getCsrfTokenCookie(res) {
  return getCookieFromRes(res, 'csrftoken')
}

function getSessionIdCookie(res) {
  return getCookieFromRes(res, 'sessionid')
}

function getCookieFromRes(res, cookiename) {
  var cookies
  if (res.headers['set-cookie'] instanceof Array) {
    cookies = res.headers['set-cookie'].map(c => Cookie.parse(c))
  } else {
    cookies = [Cookie.parse(res.headers['set-cookie'])]
  }

  const cookie = _.find(cookies, { 'key': cookiename})
  return cookie ? cookie.value : undefined
}

function doKmKisaPostKmAndMinutesForDate(kk_login, kk_password, datestr, kms, minutes) {
  return doKmKisaLogin({username: kk_login, password: kk_password})
    .then(cookieJar => {
      const csrftoken = jar => _(jar.getCookies('https://www.kilometrikisa.fi/')).find(c => c.key === 'csrftoken').value

      return requestAsync({ method: 'POST',
                            headers: { 'Referer': 'https://www.kilometrikisa.fi/contest/log/' },
                            jar: cookieJar,
                            uri: 'https://www.kilometrikisa.fi/contest/log-save/',
                            form: { csrfmiddlewaretoken: csrftoken(cookieJar),
                                    km_amount: kms.toString().replace('.', ','),
                                    contest_id: "31",
                                    km_date: datestr }
                          })
        .then(() => requestAsync({ method: 'POST',
                                   headers: { 'Referer': 'https://www.kilometrikisa.fi/contest/log/' },
                                   jar: cookieJar,
                                   uri: 'https://www.kilometrikisa.fi/contest/minute-log-save/',
                                   form: { csrfmiddlewaretoken: csrftoken(cookieJar),
                                           hours: Math.floor(minutes/60).toString(),
                                           minutes: (minutes%60).toString(),
                                           contest_id: "30",
                                           date: datestr }
                                 }))
    })
}

module.exports = {
  doKmKisaLogin: doKmKisaLogin,
  doKmKisaPostKmAndMinutesForDate: doKmKisaPostKmAndMinutesForDate
}
