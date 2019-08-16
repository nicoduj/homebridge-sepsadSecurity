const SepsadSecurityConst = require('./sepsadSecurityConst');
const request = require('request');
var locks = require('locks');
var mutex = locks.createMutex();

module.exports = {
  SepsadSecurityAPI: SepsadSecurityAPI,
};

function SepsadSecurityAPI(log, platform) {
  this.log = log;
  this.platform = platform;
  this.login = platform.login;
  this.password = platform.password;

}

SepsadSecurityAPI.prototype = {

  authenticate: function(callback) {
      callback();
  },

  getSecuritySystem: function(callback) {
    let securitySystem = {};
    securitySystem.name = 'TEST';
    securitySystem.model = 'Sepsad 123';
    securitySystem.id = '123456';

    callback(securitySystem);
  },

  getSecuritySystemState: function(callback) {
    let state = SepsadSecurityConst.DISABLED;
    callback(state);
  },

  sendCommand: function(
    command,
    characteristic,
    callback
  ) {
    callback();
  },


};

