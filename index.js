var Service, Characteristic;
var SepsadSecurityAPI = require('./sepsadSecurityAPI.js').SepsadSecurityAPI;
const SepsadSecurityConst = require('./sepsadSecurityConst');
const SepsadSecurityTools = require('./sepsadSecurityTools.js');

function mySepsadSecurityPlatform(log, config, api) {
  this.log = log;
  this.login = config['email'];
  this.password = config['password'];
  this.refreshTimer = SepsadSecurityTools.checkTimer(config['refreshTimer']);

  this.foundAccessories = [];

  this.SepsadSecurityAPI = new SepsadSecurityAPI(log, this);

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object
    this.api = api;
  }
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform(
    'homebridge-sepsadSecurity',
    'HomebridgeSepsadSecurity',
    mySepsadSecurityPlatform
  );
};

mySepsadSecurityPlatform.prototype = {
  accessories: function(callback) {
    this.SepsadSecurityAPI.authenticate(error => {
      if (error) {
        this.log.debug('ERROR - authenticating - ' + error);
        callback(undefined);
      } else {
        this.SepsadSecurityAPI.getSecuritySystem(result => {
          if (result) {
            this.log.debug('SecuritySystem : ' + JSON.stringify(result));
            let services = [];
            let securitySystemName = result.name;
            let securitySystemModel = result.model;
            let securitySystemSeriaNumber = result.id;

            let securityService = {
              controlService: new Service.SecuritySystem(securitySystemName),
              characteristics: [
                Characteristic.SecuritySystemCurrentState,
                Characteristic.SecuritySystemTargetState,
              ],
            };

            securityService.controlService.subtype =
              securitySystemName + ' SecurityService';
            securityService.controlService.id = result.id;
            services.push(securityService);

            let switchService = {
              controlService: new Service.Switch(securitySystemName),
              characteristics: [Characteristic.On],
            };

            switchService.controlService.subtype =
              securitySystemName + ' Switch';
            switchService.controlService.id = result.id;
            services.push(switchService);

            let mySecuritySystemAccessory = new SepsadSecurityTools.SepsadSecurityAccessory(
              services
            );
            mySecuritySystemAccessory.getServices = function() {
              return this.platform.getServices(mySecuritySystemAccessory);
            };
            mySecuritySystemAccessory.platform = this;
            mySecuritySystemAccessory.name = securitySystemName;
            mySecuritySystemAccessory.model = securitySystemModel;
            mySecuritySystemAccessory.manufacturer = 'Sepsad';
            mySecuritySystemAccessory.serialNumber = securitySystemSeriaNumber;
            mySecuritySystemAccessory.securitySystemID = securitySystemSeriaNumber;
            this.foundAccessories.push(mySecuritySystemAccessory);

            //timer for background refresh
            this.refreshBackground();

            callback(this.foundAccessories);
          } else {
            //prevent homebridge from starting since we don't want to loose our doors.
            this.log.debug('ERROR - gettingSecuritysystem - ' + error);
            callback(undefined);
          }
        });
      }
    });
  },

  updateState(callback, characteristic) {
    var onn = false;
    this.SepsadSecurityAPI.authenticate(error => {
      if (error) {
        callback(undefined, onn);
      } else
        this.SepsadSecurityAPI.getSecuritySystemState(result => {
          this.log.debug(
            'INFO - securitySystem result : ' + JSON.stringify(result)
          );
          if (
            characteristic == Characteristic.SecuritySystemCurrentState ||
            characteristic == Characteristic.SecuritySystemTargetState
          ) {
            switch (result) {
              case SepsadSecurityConst.DISABLED:
                callback(
                  undefined,
                  Characteristic.SecuritySystemTargetState.DISARM
                );
                break;
              case SepsadSecurityConst.PARTIAL:
                callback(
                  undefined,
                  Characteristic.SecuritySystemTargetState.NIGHT_ARM
                );
                break;
              case SepsadSecurityConst.ACTIVATED:
                callback(
                  undefined,
                  Characteristic.SecuritySystemTargetState.STAY_ARM
                );
                break;
              default:
                callback(-1);
            }
          } else {
            switch (result) {
              case SepsadSecurityConst.DISABLED:
                callback(undefined, false);
                break;
              case SepsadSecurityConst.PARTIAL:
              case SepsadSecurityConst.ACTIVATED:
                callback(undefined, true);
                break;
              default:
                callback(-1);
            }
          }
        });
    });
  },

  activate(characteristic, value, callback) {
    this.SepsadSecurityAPI.sendCommand(
      value
        ? SepsadSecurityConst.ACTIVATE_COMMAND
        : SepsadSecurityConst.STOP_COMMAND,
      characteristic,
      callback
    );
  },

  getSwitchOnCharacteristic: function(callback) {
    this.log.debug('INFO - getSwitchOnCharacteristic');
    this.updateState(callback, Characteristic.On);
  },

  setSwitchOnCharacteristic: function(characteristic, value, callback) {
    this.log.debug('INFO - setSwitchOnCharacteristic - ' + value);
    this.activate(characteristic, value, callback);
  },

  getSecuritySystemCurrentStateCharacteristic: function(callback) {
    this.log.debug('INFO - getSecuritySystemCurrentStateCharacteristic');
    this.updateState(callback, Characteristic.SecuritySystemCurrentState);
  },

  // The value property of SecuritySystemTargetState must be one of the following:
  /*
  Characteristic.SecuritySystemTargetState.STAY_ARM = 0;
  Characteristic.SecuritySystemTargetState.AWAY_ARM = 1;
  Characteristic.SecuritySystemTargetState.NIGHT_ARM = 2;
  Characteristic.SecuritySystemTargetState.DISARM = 3;
  */

  getSecuritySystemTargetStateCharacteristic: function(callback) {
    this.log.debug('INFO - getSecuritySystemTargetStateCharacteristic');
    this.updateState(callback, Characteristic.SecuritySystemTargetState);
  },
  setSecuritySystemTargetStateCharacteristic: function(
    characteristic,
    value,
    callback
  ) {
    this.log.debug(
      'INFO - setSecuritySystemTargetStateCharacteristic - ' + value
    );
    this.activate(characteristic, value, callback);
  },

  // The value property of SecuritySystemCurrentState must be one of the following:
  /*
  Characteristic.SecuritySystemCurrentState.STAY_ARM = 0;
  Characteristic.SecuritySystemCurrentState.AWAY_ARM = 1;
  Characteristic.SecuritySystemCurrentState.NIGHT_ARM = 2;
  Characteristic.SecuritySystemCurrentState.DISARMED = 3;
  Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED = 4;
  */

  bindCharacteristicEvents: function(
    characteristic,
    service,
    homebridgeAccessory
  ) {
    if (
      characteristic instanceof Characteristic.On &&
      service.controlService instanceof Service.Switch
    ) {
      characteristic.on(
        'get',
        function(callback) {
          homebridgeAccessory.platform.getSwitchOnCharacteristic(callback);
        }.bind(this)
      );

      characteristic.on(
        'set',
        function(value, callback) {
          homebridgeAccessory.platform.setSwitchOnCharacteristic(
            characteristic,
            value,
            callback
          );
        }.bind(this)
      );
    } else if (
      characteristic instanceof Characteristic.SecuritySystemCurrentState &&
      service.controlService instanceof Service.SecuritySystem
    ) {
      characteristic.on(
        'get',
        function(callback) {
          homebridgeAccessory.platform.getSecuritySystemCurrentStateCharacteristic(
            callback
          );
        }.bind(this)
      );
    } else if (
      characteristic instanceof Characteristic.SecuritySystemTargetState &&
      service.controlService instanceof Service.SecuritySystem
    ) {
      characteristic.on(
        'get',
        function(callback) {
          homebridgeAccessory.platform.getSecuritySystemTargetStateCharacteristic(
            callback
          );
        }.bind(this)
      );

      characteristic.on(
        'set',
        function(value, callback) {
          homebridgeAccessory.platform.setSecuritySystemTargetStateCharacteristic(
            characteristic,
            value,
            callback
          );
        }.bind(this)
      );
    }
  },

  refreshBackground() {
    //timer for background refresh
    if (this.refreshTimer !== undefined && this.refreshTimer > 0) {
      this.log.debug(
        'INFO - Setting Timer for background refresh every  : ' +
          this.refreshTimer +
          's'
      );
      this.timerID = setInterval(
        () => this.refreshSecuritySystems(),
        this.refreshTimer * 1000
      );
    }
  },

  refreshSecuritySystem: function() {
    this.SepsadSecurityAPI.getSecuritySystemState(result => {
      for (let s = 0; s < this.foundAccessories.length; s++) {
        let mySepsadSecuritySystemAccessory = this.foundAccessories[a];

        for (
          let s = 0;
          s < mySepsadSecuritySystemAccessory.services.length;
          s++
        ) {
          let service = mySepsadSecuritySystemAccessory.services[s];
          var value;

          if (service.controlService.UUID == Service.SecuritySystem.UUID) {
            switch (result) {
              case SepsadSecurityConst.DISABLED:
                value = Characteristic.SecuritySystemTargetState.DISARM;
                break;
              case SepsadSecurityConst.PARTIAL:
                value = Characteristic.SecuritySystemTargetState.NIGHT_ARM;
                break;
              case SepsadSecurityConst.ACTIVATED:
                value = Characteristic.SecuritySystemTargetState.STAY_ARM;
                break;
              default:
                value = -1;
            }
            service.controlService
              .getCharacteristic(Characteristic.SecuritySystemCurrentState)
              .updateValue(value);
          } else if (service.controlService.UUID == Service.Switch.UUID) {
            switch (result) {
              case SepsadSecurityConst.DISABLED:
                value = false;
                break;
              case SepsadSecurityConst.PARTIAL:
              case SepsadSecurityConst.ACTIVATED:
                value = true;
                break;
              default:
                value = -1;
            }

            service.controlService
              .getCharacteristic(Characteristic.On)
              .updateValue(value);
          }
        }
      }
    });
  },

  refreshSecuritySystem: function(mySepsadSecurityAccessory, result) {
    for (let s = 0; s < mySepsadSecurityAccessory.services.length; s++) {
      let service = mySepsadSecurityAccessory.services[s];

      if (service.controlService instanceof Service.Switch) {
        service.controlService
          .getCharacteristic(Characteristic.On)
          .updateValue(this.isInOperation(mySepsadSecurityAccessory, result));
      }
    }
  },

  getInformationService: function(homebridgeAccessory) {
    let informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Name, homebridgeAccessory.name)
      .setCharacteristic(
        Characteristic.Manufacturer,
        homebridgeAccessory.manufacturer
      )
      .setCharacteristic(Characteristic.Model, homebridgeAccessory.model)
      .setCharacteristic(
        Characteristic.SerialNumber,
        homebridgeAccessory.serialNumber
      );
    return informationService;
  },

  getServices: function(homebridgeAccessory) {
    let services = [];
    let informationService = homebridgeAccessory.platform.getInformationService(
      homebridgeAccessory
    );
    services.push(informationService);
    for (let s = 0; s < homebridgeAccessory.services.length; s++) {
      let service = homebridgeAccessory.services[s];
      for (let i = 0; i < service.characteristics.length; i++) {
        let characteristic = service.controlService.getCharacteristic(
          service.characteristics[i]
        );
        if (characteristic == undefined)
          characteristic = service.controlService.addCharacteristic(
            service.characteristics[i]
          );

        homebridgeAccessory.platform.bindCharacteristicEvents(
          characteristic,
          service,
          homebridgeAccessory
        );
      }
      services.push(service.controlService);
    }
    return services;
  },
};
