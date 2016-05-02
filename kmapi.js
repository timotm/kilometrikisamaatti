var Promise = require('bluebird')
var requestAsync = Promise.promisify(require('request').defaults({strictSSL: false}))
var Cookie = require('tough-cookie').Cookie
var _ = require('lodash')

function HttpError(status, msg) {
  var ret = new Error(msg)
  ret.status = status
  return ret
}

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
      return cookieJar
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

function doKmKisaPostKmForDate(kk_login, kk_password, datestr, kms) {
  return doKmKisaLogin({username: kk_login, password: kk_password})
    .then(function (cookieJar) {
      var cookies = cookieJar.getCookies('https://www.kilometrikisa.fi/')
      csrftoken = _(cookies).find(function (c) { return c.key === 'csrftoken' }).value
      return requestAsync({ method: 'POST',
                            headers: { 'Referer': 'https://www.kilometrikisa.fi/contest/log/' },
                            jar: cookieJar,
                            uri: 'https://www.kilometrikisa.fi/contest/log-save/',
                            form: { csrfmiddlewaretoken: csrftoken,
                                    km_amount: kms.toString().replace('.', ','),
                                    contest_id: "16",
                                    km_date: datestr },
                          })
    })
}

module.exports = {
  doKmKisaLogin: doKmKisaLogin,
  doKmKisaPostKmForDate: doKmKisaPostKmForDate,
}
