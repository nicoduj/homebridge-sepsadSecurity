const SepsadSecurityConst = require('./sepsadSecurityConst');
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
  this.securitySystem = undefined;

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

  authenticate: function (callback) {
    var dte = new Date();

    if (!this.token || (this.access_token && this.loginExpires && this.loginExpires < dte)) {
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

              //DEBUG
              /*
              mutex.unlock();
              callback();

              that.log.debug('INFO - jsonBody  : ' + JSON.stringify(jsonBody));
              that.log.debug('INFO - apiHeaders  : ' + JSON.stringify(that.apiHeaders));
              */

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
                  that.log.debug('INFO - connect response : ' + JSON.stringify(response));
                  that.log.debug('INFO - connect body : ' + JSON.stringify(body));
                  mutex.unlock();

                  if (error || (response && response.statusCode !== 200)) {
                    that.log('ERROR - connect body : ' + JSON.stringify(body));
                    callback(-1);
                  } else {
                    that.idSession = body.idSession;
                    that.securitySystem = {};
                    that.securitySystem.name = body.sites[0].title;
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
            url: that.apiURL + 'system/status/' + that.idSession + '/0/0/0/0',
            method: 'GET',
            headers: that.apiHeaders,
            json: true,
          },
          function (error, response, body) {
            that.log.debug('INFO - status error : ' + error);
            that.log.debug('INFO - status response : ' + JSON.stringify(response));
            that.log.debug('INFO - status body : ' + JSON.stringify(body));

            if (error || (response && response.statusCode !== 200)) {
              that.log('ERROR - connect body : ' + JSON.stringify(body));
              that.emit('securitySystemRefreshError');
            } else {
              if (body.securityParameters.mode == 'OFF')
                that.securitySystem.state = SepsadSecurityConst.DISABLED;
              else that.securitySystem.state = SepsadSecurityConst.ACTIVATED;

              that.emit('securitySystemRefreshed');
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
    const that = this;

    this.authenticate((error) => {
      if (error) {
        callback(false);
      } else {
        request(
          {
            url: that.apiURL + 'system/SetStatus/' + that.idSession + '/0/0/0/0',
            method: 'POST',
            headers: that.apiHeaders,
            json: true,
          },
          function (error, response, body) {
            that.log.debug('INFO - SetStatus error : ' + error);
            that.log.debug('INFO - SetStatus response : ' + JSON.stringify(response));
            that.log.debug('INFO - SetStatus body : ' + JSON.stringify(body));

            if (error || (response && response.statusCode !== 200)) {
              that.log('ERROR - SetStatus body : ' + JSON.stringify(body));
              callback(false);
            } else {
              callback(true);
            }
          }
        );
      }
    });
  },
};

inherits(SepsadSecurityAPI, EventEmitter);
