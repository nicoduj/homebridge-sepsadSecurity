const request = require('request');
var locks = require('locks');
var mutex = locks.createMutex();

var EventEmitter = require('events');
var inherits = require('util').inherits;

module.exports = {
  SepsadSecurityAPI: SepsadSecurityAPI,
};

function SepsadSecurityAPI(log, platform) {
  EventEmitter.call(this);

  this.log = log;
  this.platform = platform;
  this.login = platform.login;
  this.password = platform.password;
  this.originSession = platform.originSession;
  this.securitySystem = {};

  this.tokenHeaders = {
    accept: '*/*',
    'Content-type': 'application/x-www-form-urlencoded',
    authorization:
      'Basic emVWRkd3MTNNZE5rTFdSaU1pclBCT0tlemNvYTpod3lfa1BiemtpazUwWkMyZ1NEVmdickRGdDBh',
  };

  this.connectHeaders = {
    accept: '*/*',
    'Content-type': 'application/json',
  };

  this.apiHeaders = {
    accept: '*/*',
    'Content-type': 'application/json',
  };

  this.apiURL = 'https://www.eps-wap.fr/smartphone/Production/4.0/?/';
}

SepsadSecurityAPI.prototype = {
  getStateString: function (state) {
    if (state == 0) return 'STAY_ARM';
    else if (state == 1) return 'AWAY_ARM';
    else if (state == 2) return 'NIGHT_ARM';
    else if (state == 3) return 'DISARMED';
    else if (state == 4) return 'ALARM_TRIGGERED';
  },

  /*
  [4/27/2020, 12:05:56 AM] [SepsadSecurity] ERROR - status body : "<html><body><h1>Service Unavailable</h1></body></html>"
[4/27/2020, 12:08:56 AM] [SepsadSecurity] ERROR - status body : "<html><body><h1>Service Unavailable</h1></body></html>"
[4/27/2020, 12:11:56 AM] [SepsadSecurity] ERROR - status body : "<html><body><h1>Service Unavailable</h1></body></html>"
[4/27/2020, 12:14:57 AM] [SepsadSecurity] ERROR - status body : {"keyMessage":"SESSION_EXPIREE","level":"CONNECTION"}
[4/27/2020, 12:17:51 AM] [NicoNetatmo] Loading new data from API for: weatherstation
[4/27/2020, 12:17:57 AM] [SepsadSecurity] ERROR - status body : {"keyMessage":"SESSION_EXPIREE","level":"CONNECTION"}
[4/27/2020, 12:20:57 AM] [SepsadSecurity] ERROR - status body : {"keyMessage":"SESSION_EXPIREE","level":"CONNECTION"}
[4/27/2020, 12:23:57 AM] [SepsadSecurity] ERROR - status body : {"keyMessage":"SESSION_EXPIREE","level":"CONNECTION"}
[4/27/2020, 12:26:57 AM] [SepsadSecurity] ERROR - status body : {"keyMessage":"SESSION_EXPIREE","level":"CONNECTION"}
[4/27/2020, 12:29:57 AM] [SepsadSecurity] ERROR - status body : {"keyMessage":"SESSION_EXPIREE","level":"CONNECTION"}

*/

  disconnect: function () {
    this.access_token = undefined;
    this.loginExpires = undefined;
    this.loginExpiry = undefined;
  },

  authenticate: function (callback) {
    var dte = new Date();

    if (!this.access_token || (this.access_token && this.loginExpires && this.loginExpires < dte)) {
      this.log.debug('INFO - authenticating');

      var that = this;

      mutex.lock(function () {
        request(
          {
            url: that.apiURL + 'token',
            method: 'POST',
            headers: that.tokenHeaders,
            body: 'grant_type=client_credentials&scope=PRODUCTION',
          },
          function (error, response, body) {
            that.log.debug('INFO - token error : ' + error);
            that.log.debug('INFO - token response : ' + JSON.stringify(response));
            that.log.debug('INFO - token body : ' + JSON.stringify(body));

            if (error || (response && response.statusCode !== 200)) {
              mutex.unlock();
              that.log('ERROR - token body : ' + JSON.stringify(body));
              callback(-1);
            } else {
              let result = JSON.parse(body);

              that.access_token = result.access_token;
              that.loginExpiry = result.expires_in * 1000;
              that.loginExpires = new Date();
              that.loginExpires.setMilliseconds(
                that.loginExpires.getMilliseconds() + that.loginExpiry - 30000
              );

              that.apiHeaders['authorization'] = 'Bearer ' + that.access_token;

              var jsonBody = {
                application: 'SMARTPHONE',
                login: that.login,
                pwd: that.password,
                typeDevice: 'SMARTPHONE',
                originSession: that.originSession,
                phoneType: '',
                codeLanguage: 'FR',
                version: '',
                timestamp: '0',
                system: '',
              };

              request(
                {
                  url: that.apiURL + 'connect',
                  method: 'POST',
                  headers: that.apiHeaders,
                  body: jsonBody,
                  json: true,
                },
                function (error, response, body) {
                  that.log.debug('INFO - connect error : ' + error);
                  // that.log.debug('INFO - connect response : ' + JSON.stringify(response));
                  // that.log.debug('INFO - connect body : ' + JSON.stringify(body));
                  mutex.unlock();

                  if (error || (response && response.statusCode !== 200)) {
                    that.log('ERROR - connect body : ' + JSON.stringify(body));
                    that.disconnect();
                    callback(-1);
                  } else {
                    that.idSession = body.idSession;

                    that.securitySystem.name = body.sites[0].title;
                    that.securitySystem.procedure = body.sites[0].procedure; // INTERVENTION or ?
                    that.securitySystem.model = that.originSession;
                    that.securitySystem.id = body.sites[0].siteId;

                    callback();
                  }
                }
              );
            }
          }
        );
      });
    } else {
      this.log.debug('INFO - allready authenticate expiration : ' + this.loginExpires + '-' + dte);
      callback();
    }
  },

  getSecuritySystem: function () {
    const that = this;

    this.authenticate((error) => {
      if (error) {
        that.emit('securitySystemRefreshError');
      } else {
        request(
          {
            url: that.apiURL + 'homepage/' + that.idSession,
            method: 'GET',
            headers: that.apiHeaders,
            json: true,
          },
          function (error, response, body) {
            that.log.debug('INFO - status error : ' + error);
            that.log.debug('INFO - status response : ' + JSON.stringify(response));
            that.log.debug('INFO - status body : ' + JSON.stringify(body));

            if (error || (response && response.statusCode !== 200)) {
              that.log('ERROR - status body : ' + JSON.stringify(body));
              // we disconnect just in case :)
              that.disconnect();
              that.emit('securitySystemRefreshError');
            } else {
              that.securitySystem.security = body.security;
              that.securitySystem.fire = body.fire;
              that.securitySystem.temperature = body.temperature;
              that.securitySystem.systemLastState = body.systemLastState;
              that.emit('securitySystemRefreshed');
            }
          }
        );
      }
    });
  },

  getTemperature() {
    const that = this;

    this.authenticate((error) => {
      if (error) {
        that.emit('securitySystemTemperatureRefreshError');
      } else {
        request(
          {
            url: that.apiURL + 'temperature/followup/last/' + that.idSession,
            method: 'GET',
            headers: that.apiHeaders,
            json: true,
          },
          function (error, response, body) {
            that.log.debug('INFO - getTemperature error : ' + error);
            that.log.debug('INFO - getTemperature response : ' + JSON.stringify(response));
            that.log.debug('INFO - getTemperature body : ' + JSON.stringify(body));

            if (error || (response && response.statusCode !== 200)) {
              that.log('ERROR - getTemperature body : ' + JSON.stringify(body));
              that.disconnect();
              that.emit('securitySystemTemperatureRefreshError');
            } else {
              that.securitySystem.temperatureInfo = body.statements;
              that.log.debug(
                'INFO - temperature info: ' + JSON.stringify(that.securitySystem.temperatureInfo)
              );

              that.emit('securitySystemTemperatureRefreshed');
            }
          }
        );
      }
    });
  },

  activateSecuritySystem: function (mode, callback) {
    //generate error
    //callback(true);
    //no error
    //callback false
    const that = this;

    this.authenticate((error) => {
      if (error) {
        callback(true);
      } else {
        var jsonBody = {
          idSession: that.idSession,
          silentMode: false,
          interventionService: that.securitySystem.procedure == 'INTERVENTION' ? true : false,
          systemMode: mode, // PARTIAL or "TOTAL"
        };

        request(
          {
            url: that.apiURL + 'system/askstart/',
            method: 'POST',
            headers: that.apiHeaders,
            body: jsonBody,
            json: true,
          },
          function (error, response, body) {
            that.log.debug('INFO - activateSecuritySystem error : ' + error);
            that.log.debug('INFO - activateSecuritySystem response : ' + JSON.stringify(response));
            that.log.debug('INFO - activateSecuritySystem body : ' + JSON.stringify(body));

            if (error || (response && response.statusCode !== 200)) {
              that.log('ERROR - activateSecuritySystem body : ' + JSON.stringify(body));
              callback(true);
            } else {
              callback(false);
            }
          }
        );
      }
    });
  },
};

inherits(SepsadSecurityAPI, EventEmitter);
