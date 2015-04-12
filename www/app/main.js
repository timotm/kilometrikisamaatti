define(function (require) {
  var Bacon = require('bacon')
  var BJQ = require('bacon.jquery')
  var Handlebars = require('handlebars')

  console.log(Handlebars)
  var userinfoE = getJsonE('/rest/userinfo')
  userinfoE.onValue(userinfoReceived)

  function userinfoReceived(userinfo) {
    if (!userinfo.hasOwnProperty('user')) {
      login()
    } else {
      $('#username').val(userinfo.user)
      $('#step1').addClass('disabled')

      if (!userinfo.moves && !userinfo.strava) {
        $('#step2').removeClass('disabled')
      }
      else {
        $('#step3').removeClass('disabled')
      }
    }
  }

  function login() {
    var username = Bacon.$.textFieldValue($('#username'))
    var password = Bacon.$.textFieldValue($('#password'))

    function nonEmpty(s) { return s.length > 0 }

    usernameEntered = username.map(nonEmpty)
    passwordEntered = password.map(nonEmpty)

    buttonEnabled = usernameEntered.and(passwordEntered)
    buttonEnabled.onValue(function(enabled) {
      $("#login").attr("disabled", !enabled)
    })

    $('body').find('#login').clickE().onValue(function() {
      var loginE = postJsonE('/rest/login', { username: $('#username').val(), password: $('#password').val() })

      loginE.onValue(function() {
        location.reload()
      })

      loginE.onError(function(err) {
        $('#message').empty().append("Kirjautuminen epäonnistui, tarkista salasanasi")
      })
    })
  }

  function getJsonE(url) {
    return Bacon.$.ajax({url: url, dataType: 'json', timeout: 30000})
  }

  function postJsonE(url, data) {
    return Bacon.$.ajax({type: 'POST', dataType: 'json', url: url, data: JSON.stringify(data), contentType: 'application/json; charset=UTF-8', timeout: 30000})
  }
})
