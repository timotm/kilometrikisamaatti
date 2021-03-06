const dbString = process.env.DATABASE_URL || 'postgres://localhost/kilometrikisamaatti'


function getAccessTokensAsync(pgrm, kk_login) {
  return pgrm.queryAsync('select moves_accesstoken is not null as moves, strava_accesstoken is not null as strava from login where kk_login = $1', [kk_login])
    .then(data => data[0])
}

function getAllTokens(pgrm) {
  return pgrm.queryAsync('select moves_accesstoken, strava_accesstoken, strava_refreshtoken, kk_login, kk_passwd from login')
}

function getTokensForLogin(pgrm, login) {
  return pgrm.queryAsync('select moves_accesstoken, strava_accesstoken, strava_refreshtoken, kk_login, kk_passwd from login where kk_login = $1', [login])
}

function saveCredentialsAsync(pgrm, username, password) {
  var insert = {
    text: 'insert into login (kk_login, kk_passwd) select $1, $2',
    values: [username, password]
  }

  var update = {
    text: 'update login set kk_passwd = $2 where kk_login = $1',
    values: [username, password]
  }

  var q = pgrm.createUpsertCTE('login', 'kk_login', {insert: insert, update: update})

  return pgrm.queryAsync(q.text, q.values)
    .then(data => data[0].kk_login)
}

function saveMovesAccessTokenAsync(pgrm, username, accessToken) {
  return pgrm.queryAsync('update login set moves_accesstoken = $2 where kk_login = $1', [username, accessToken])
}

function saveStravaTokensAsync(pgrm, username, accessToken, refreshToken) {
  return pgrm.queryAsync('update login set strava_accesstoken = $2, strava_refreshtoken = $3 where kk_login = $1', [username, accessToken, refreshToken])
}

module.exports = function () {
  var pgrm = require('pg-using-bluebird')({dbUrl: dbString})

  return {
    getAccessTokensAsync: function getAccessTokensAsyncWithPgrm(kk_login) { return getAccessTokensAsync(pgrm, kk_login) },
    saveCredentialsAsync: function saveCredentialsAsyncWithPgrm(username, password) { return saveCredentialsAsync(pgrm, username, password) },
    saveMovesAccessTokenAsync: function saveMovesAccessTokenAsyncWithPgrm(username, token) { return saveMovesAccessTokenAsync(pgrm, username, token) },
    saveStravaTokensAsync: function saveStravaTokensAsyncWithPgRm(username, access, refresh) { return saveStravaTokensAsync(pgrm, username, access, refresh) },
    getAllTokensAsync: function getAllTokensAsyncWithPgrm() { return getAllTokens(pgrm) },
    getTokensForLoginAsync: function getTokensForLoginAsyncWithPgrm(kk_login) { return getTokensForLogin(pgrm, kk_login) },
    dbString
  }
}
