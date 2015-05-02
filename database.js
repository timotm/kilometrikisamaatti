
function getAccessTokensAsync(pgrm, kk_login) {
  return pgrm.queryAsync('select moves_accesstoken is not null as moves, strava_accesstoken is not null as strava from login where kk_login = $1', [kk_login])
    .then(function (data) {
      return data[0]
    })
}

function getAllTokens(pgrm) {
  return pgrm.queryAsync('select moves_accesstoken, strava_accesstoken, kk_login, kk_passwd from login')
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
    .then(function (data) {
      return data[0].kk_login
    })
}

function saveMovesAccessTokenAsync(pgrm, username, accessToken) {
  return pgrm.queryAsync('update login set moves_accesstoken = $2 where kk_login = $1', [username, accessToken])
}

function saveStravaAccessTokenAsync(pgrm, username, accessToken) {
  return pgrm.queryAsync('update login set strava_accesstoken = $2 where kk_login = $1', [username, accessToken])
}

module.exports = function (dbUrl) {
  var pgrm = require('pg-using-bluebird')({dbUrl: dbUrl})

  return {
    getAccessTokensAsync: function getAccessTokensAsyncWithPgrm(kk_login) { return getAccessTokensAsync(pgrm, kk_login) },
    saveCredentialsAsync: function saveCredentialsAsyncWithPgrm(username, password) { return saveCredentialsAsync(pgrm, username, password) },
    saveMovesAccessTokenAsync: function saveMovesAccessTokenAsyncWithPgrm(username, token) { return saveMovesAccessTokenAsync(pgrm, username, token) },
    saveStravaAccessTokenAsync: function saveStravaAccessTokenAsyncWithPgrm(username, token) { return saveStravaAccessTokenAsync(pgrm, username, token) },
    getAllTokensAsync: function getAllTokensAsyncWithPgrm() { return getAllTokens(pgrm) },
  }
}
