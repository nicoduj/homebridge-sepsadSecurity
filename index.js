var Service, Characteristic, Accessory, UUIDGen;

var SepsadSecurityAPI = require('./sepsadSecurityAPI.js').SepsadSecurityAPI;
const SepsadSecurityTools = require('./sepsadSecurityTools.js');
const SepsadSecurityConst = require('./sepsadSecurityConst');

function mySepsadSecurityPlatform(log, config, api) {
  if (!config) {
    log('No configuration found for homebridge-sepsadSecurity');
    return;
  }

  this.api = api;
  this.log = log;
  this.login = config['login'];
  this.password = config['password'];

  this.refreshTimer = SepsadSecurityTools.checkParameter(config['refreshTimer'], 30, 600, 180);

  this.refreshTimerDuringOperation = SepsadSecurityTools.checkParameter(
    config['refreshTimerDuringOperation'],
    2,
    15,
    5
  );
  this.maxWaitTimeForOperation = SepsadSecurityTools.checkParameter(
    config['maxWaitTimeForOperation'],
    30,
    90,
    20
  );
  this.originSession = config['originSession'] ? config['originSession'] : 'SEPSAD';

  this.allowActivation = SepsadSecurityTools.checkBoolParameter(config['allowActivation'], false);

  this.cleanCache = config['cleanCache'];

  this.foundAccessories = [];
  this.sepsadSecurityAPI = new SepsadSecurityAPI(log, this);

  this.loaded = false;

  this.api
    .on(
      'shutdown',
      function () {
        this.end();
      }.bind(this)
    )
    .on(
      'didFinishLaunching',
      function () {
        this.log('DidFinishLaunching');

        if (this.cleanCache) {
          this.log('WARNING - Removing Accessories');
          this.api.unregisterPlatformAccessories(
            'homebridge-sepsadSecurity',
            'SepsadSecurity',
            this.foundAccessories
          );
          this.foundAccessories = [];
        }
        this.discoverSecuritySystem();
      }.bind(this)
    );
}

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Accessory = homebridge.platformAccessory;
  UUIDGen = homebridge.hap.uuid;
  HomebridgeAPI = homebridge;
  homebridge.registerPlatform(
    'homebridge-sepsadSecurity',
    'SepsadSecurity',
    mySepsadSecurityPlatform,
    true
  );
};

mySepsadSecurityPlatform.prototype = {
  configureAccessory: function (accessory) {
    this.log.debug(accessory.displayName, 'Got cached Accessory ' + accessory.UUID);

    this.foundAccessories.push(accessory);
  },

  end() {
    this.log('INFO - shutdown');
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = undefined;
    }
    // disconnecting ?
  },

  discoverSecuritySystem: function () {
    this.sepsadSecurityAPI.on('securitySystemRefreshError', () => {
      if (this.timerID == undefined) {
        this.log('ERROR - discoverSecuritySystem - will retry in 1 minute');
        setTimeout(() => {
          this.sepsadSecurityAPI.getSecuritySystem();
        }, 60000);
      }
    });

    this.sepsadSecurityAPI.on('securitySystemRefreshed', () => {
      this.log.debug('INFO - securitySystemRefreshed event');
      if (!this.loaded) {
        this.loadSecuritySystem();
      } else {
        this.updateSecuritySystem();
      }
    });

    this.sepsadSecurityAPI.getSecuritySystem();
  },

  loadSecuritySystem() {
    if (this.sepsadSecurityAPI.securitySystem) {
      this.log.debug(
        'INFO - SecuritySystem : ' + JSON.stringify(this.sepsadSecurityAPI.securitySystem)
      );
      let securitySystemName = this.sepsadSecurityAPI.securitySystem.name;
      let securitySystemModel = this.sepsadSecurityAPI.securitySystem.model;
      let securitySystemSeriaNumber = this.sepsadSecurityAPI.securitySystem.id;

      let uuid = UUIDGen.generate(securitySystemName);
      let mySecuritySystemAccessory = this.foundAccessories.find((x) => x.UUID == uuid);

      if (!mySecuritySystemAccessory) {
        mySecuritySystemAccessory = new Accessory(securitySystemName, uuid);
        mySecuritySystemAccessory.name = securitySystemName;
        mySecuritySystemAccessory.model = securitySystemModel;
        mySecuritySystemAccessory.manufacturer = 'Sepsad/EPS';
        mySecuritySystemAccessory.serialNumber = securitySystemSeriaNumber;
        mySecuritySystemAccessory.securitySystemID = securitySystemSeriaNumber;

        mySecuritySystemAccessory
          .getService(Service.AccessoryInformation)
          .setCharacteristic(Characteristic.Manufacturer, mySecuritySystemAccessory.manufacturer)
          .setCharacteristic(Characteristic.Model, mySecuritySystemAccessory.model)
          .setCharacteristic(Characteristic.SerialNumber, mySecuritySystemAccessory.serialNumber);

        this.api.registerPlatformAccessories('homebridge-sepsadSecurity', 'SepsadSecurity', [
          mySecuritySystemAccessory,
        ]);

        this.foundAccessories.push(mySecuritySystemAccessory);
      }

      mySecuritySystemAccessory.securitySystemID = securitySystemSeriaNumber;
      mySecuritySystemAccessory.name = securitySystemName;

      let HKSecurityService = mySecuritySystemAccessory.getServiceByUUIDAndSubType(
        securitySystemName,
        'SecuritySystemService' + securitySystemName
      );

      if (!HKSecurityService) {
        this.log('INFO - Creating SecurityService Service ' + securitySystemName);
        HKSecurityService = new Service.SecuritySystem(
          securitySystemName,
          'SecuritySystemService' + securitySystemName
        );
        HKSecurityService.subtype = 'SecuritySystemService' + securitySystemName;
        mySecuritySystemAccessory.addService(HKSecurityService);
      }

      this.bindSecuritySystemCurrentStateCharacteristic(HKSecurityService);
      this.bindSecuritySystemTargetStateCharacteristic(HKSecurityService);

      // Required Characteristics
      //this.addCharacteristic(Characteristic.SecuritySystemCurrentState);
      //this.addCharacteristic(Characteristic.SecuritySystemTargetState);
      // Optional Characteristics
      //this.addOptionalCharacteristic(Characteristic.StatusFault);
      //this.addOptionalCharacteristic(Characteristic.StatusTampered);
      //this.addOptionalCharacteristic(Characteristic.SecuritySystemAlarmType);
      //this.addOptionalCharacteristic(Characteristic.Name);

      this.updateSecuritySystem();
      this.loaded = true;

      //timer for background refresh
      this.refreshBackground();
    } else {
      this.log(
        'ERROR - discoverSecuritySystem - no security system found, will retry in 1 minute - ' +
          result
      );

      setTimeout(() => {
        this.sepsadSecurityAPI.getSecuritySystem();
      }, 60000);
    }
  },

  updateSecuritySystem() {
    for (let a = 0; a < this.foundAccessories.length; a++) {
      this.log.debug('INFO - refreshing - ' + this.foundAccessories[a].name);

      let securitySystemResult = undefined;
      if (
        this.sepsadSecurityAPI.securitySystem &&
        this.sepsadSecurityAPI.securitySystem.id == this.foundAccessories[a].securitySystemID
      ) {
        securitySystemResult = this.sepsadSecurityAPI.securitySystem;
      }

      if (securitySystemResult !== undefined) {
        this.refreshSecuritySystem(this.foundAccessories[a], securitySystemResult);
      } else {
        this.log(
          'ERROR - updateSecuritySystem - no result for securitySystem - ' +
            this.foundAccessories[a].name
        );
      }
    }
  },

  getCurrentSecuritySystemStateCharacteristic: function (service, callback) {
    callback(undefined, service.getCharacteristic(Characteristic.SecuritySystemCurrentState).value);

    //no operationInProgress, refresh current state
    if (service.TargetSecuritySystemStateOperationStart == undefined) {
      this.sepsadSecurityAPI.getSecuritySystem();
    }
  },

  getTargetSecuritySystemStateCharacteristic: function (service, callback) {
    callback(undefined, service.getCharacteristic(Characteristic.SecuritySystemTargetState).value);
    //handled through currentState
  },

  // Characteristic.SecuritySystemCurrentState.STAY_ARM = 0;
  // Characteristic.SecuritySystemCurrentState.AWAY_ARM = 1;
  // Characteristic.SecuritySystemCurrentState.NIGHT_ARM = 2;
  // Characteristic.SecuritySystemCurrentState.DISARMED = 3;
  // Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED = 4;
  // */
  // Characteristic.SecuritySystemTargetState.STAY_ARM = 0;
  // Characteristic.SecuritySystemTargetState.AWAY_ARM = 1;
  // Characteristic.SecuritySystemTargetState.NIGHT_ARM = 2;
  // Characteristic.SecuritySystemTargetState.DISARM = 3;
  setTargetSecuritySystemtateCharacteristic: function (service, value, callback) {
    var currentValue = service.getCharacteristic(Characteristic.SecuritySystemTargetState).value;
    var currentState = service.getCharacteristic(Characteristic.SecuritySystemCurrentState).value;
    var that = this;

    callback();

    if (currentState != value) {
      if (value < Characteristic.SecuritySystemTargetState.DISARM && this.allowActivation) {
        this.log.debug(
          'INFO - SET Characteristic.SecuritySystemTargetState - ' +
            service.subtype +
            ' - SecuritySystemCurrentState is ' +
            this.sepsadSecurityAPI.getStateString(currentState)
        );
        this.sepsadSecurityAPI.activateSecuritySystem(service, function (error) {
          if (error) {
            that.endSecuritySystemOperation(service);
            that.log.debug(
              'ERROR - SET Characteristic.SecuritySystemTargetState - ' +
                service.subtype +
                ' error activating '
            );

            setTimeout(() => {
              service
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .updateValue(currentValue);
              service
                .getCharacteristic(Characteristic.SecuritySystemCurrentState)
                .updateValue(currentState);
            }, 500);
          } else {
            that.beginSecuritySystemOperation(service, value);
            that.log.debug(
              'INFO - SET Characteristic.SecuritySystemTargetState - ' +
                service.subtype +
                ' success activating '
            );
          }
        });
      } else {
        //CANCEL
        setTimeout(() => {
          service
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .updateValue(currentValue);
          service
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .updateValue(currentState);
        }, 500);
      }
    }
  },

  bindSecuritySystemCurrentStateCharacteristic: function (service) {
    service.getCharacteristic(Characteristic.SecuritySystemCurrentState).on(
      'get',
      function (callback) {
        this.getCurrentSecuritySystemStateCharacteristic(service, callback);
      }.bind(this)
    );
  },

  bindSecuritySystemTargetStateCharacteristic: function (service) {
    service
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on(
        'get',
        function (callback) {
          this.getTargetSecuritySystemStateCharacteristic(service, callback);
        }.bind(this)
      )
      .on(
        'set',
        function (value, callback) {
          this.setTargetSecuritySystemtateCharacteristic(service, value, callback);
        }.bind(this)
      );
  },

  beginSecuritySystemOperation(service, state) {
    //stop timer if one exists.

    if (this.timerID !== undefined) {
      clearInterval(this.timerID);
      this.timerID = undefined;
    }

    service.TargetSecuritySystemState = state;
    service.TargetSecuritySystemStateOperationStart = Date.now();

    //start operating timer
    this.log.debug(
      'INFO - beginSecuritySystemOperation - ' + service.subtype + ' - Setting Timer for operation'
    );

    this.timerID = setInterval(() => {
      this.sepsadSecurityAPI.getSecuritySystem();
    }, this.refreshTimerDuringOperation * 1000);
  },

  endSecuritySystemOperation(service) {
    //stop timer for this operation
    this.log.debug(
      'INFO - endSecuritySystemOperation - ' + service.subtype + ' - Stopping operation'
    );

    service.TargetSecuritySystemState = undefined;
    service.TargetSecuritySystemStateOperationStart = undefined;

    this.checkEndOperation();
  },

  checkEndOperation() {
    //clear timer and set background again if no other operation in progress

    if (this.timerID !== undefined) {
      let operationInProgress = false;
      for (let a = 0; a < this.foundAccessories.length; a++) {
        let mySecuritySystemAccessory = this.foundAccessories[a];
        for (let s = 0; s < mySecuritySystemAccessory.services.length; s++) {
          let service = mySecuritySystemAccessory.services[s];
          if (service.TargetSecuritySystemState !== undefined) {
            operationInProgress = true;
            break;
          }
        }
        if (operationInProgress) break;
      }

      if (!operationInProgress) {
        this.log.debug('Stopping Operation Timer ');
        clearInterval(this.timerID);
        this.timerID = undefined;
        this.refreshBackground();
      }
    }
  },

  operationMode(result) {
    if (result.state == SepsadSecurityConst.DISABLED) {
      return Characteristic.SecuritySystemCurrentState.DISARMED;
    } else if (result.state == SepsadSecurityConst.ACTIVATED) {
      return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
    } else if (result.state == SepsadSecurityConst.PARTIAL) {
      return Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
    } else {
      return -1;
    }
  },

  refreshBackground() {
    //timer for background refresh
    if (this.refreshTimer !== undefined && this.refreshTimer > 0) {
      this.log.debug(
        'INFO - Setting Timer for background refresh every  : ' + this.refreshTimer + 's'
      );
      this.timerID = setInterval(
        () => this.sepsadSecurityAPI.getSecuritySystem(),
        this.refreshTimer * 1000
      );
    }
  },

  refreshSecuritySystem: function (mySepsadSecurityAccessory, result) {
    let securitySystemName = mySepsadSecurityAccessory.name;

    let HKSecurityService = mySepsadSecurityAccessory.getServiceByUUIDAndSubType(
      securitySystemName,
      'SecuritySystemService' + securitySystemName
    );

    if (!HKSecurityService) {
      this.log('Error - refreshSecuritySystem - ' + securitySystemName + ' - no service found');
      return;
    }

    let currentSecurityServiceState = this.operationMode(result);

    let operationInProgress =
      HKSecurityService.TargetSecuritySystemStateOperationStart !== undefined;
    let operationInProgressIsFinished =
      operationInProgress &&
      HKSecurityService.TargetSecuritySystemState == currentSecurityServiceState;

    let oldSecurityServiceState = HKSecurityService.getCharacteristic(
      Characteristic.SecuritySystemCurrentState
    ).value;
    let oldTargetState = HKSecurityService.getCharacteristic(
      Characteristic.SecuritySystemTargetState
    ).value;

    this.log.debug(
      'INFO - refreshSecuritySystem - Got Status for : ' +
        HKSecurityService.subtype +
        ' - (currentState/operationInProgress/operationInProgressIsFinished/oldState/oldTargetState) : (' +
        currentSecurityServiceState +
        '/' +
        operationInProgress +
        '/' +
        operationInProgressIsFinished +
        '/' +
        oldSecurityServiceState +
        '/' +
        oldTargetState +
        ')'
    );

    var newSecurityServiceState = oldSecurityServiceState;
    var newTargetState = oldTargetState;

    //operation has finished or timed out

    if (operationInProgressIsFinished || this.endOperation(HKSecurityService, result)) {
      this.endSecuritySystemOperation(HKSecurityService);
      if (!operationInProgressIsFinished) {
        this.log(
          'WARNING - refreshSecuritySystem - ' +
            HKSecurityService.subtype +
            ' - operation was in progress and has timedout or no status retrieval'
        );
      }
      newSecurityServiceState = currentSecurityServiceState;
      newTargetState = currentSecurityServiceState;
    } else if (!operationInProgress && currentSecurityServiceState != oldSecurityServiceState) {
      newSecurityServiceState = currentSecurityServiceState;
      newTargetState = currentSecurityServiceState;
    }

    if (newTargetState != oldTargetState) {
      this.log.debug(
        'INFO - refreshSecuritySystem - ' +
          HKSecurityService.subtype +
          ' updating TargetState to : ' +
          newTargetState +
          '-' +
          this.sepsadSecurityAPI.getStateString(newTargetState)
      );
      //TargetState before CurrentState
      setImmediate(() => {
        HKSecurityService.getCharacteristic(Characteristic.SecuritySystemTargetState).updateValue(
          newTargetState
        );
      });
    }

    if (newSecurityServiceState != oldSecurityServiceState) {
      this.log.debug(
        'INFO - refreshSecuritySystem - ' +
          HKSecurityService.subtype +
          ' updating CurrenState to : ' +
          this.sepsadSecurityAPI.getStateString(newSecurityServiceState)
      );
      setImmediate(() => {
        HKSecurityService.getCharacteristic(Characteristic.SecuritySystemCurrentState).updateValue(
          newSecurityServiceState
        );
      });
    }
  },

  endOperation(service, result) {
    // TODO CHECK CHECK
    if (result.state == SepsadSecurityConst.UNKNOWN) return true;

    //timeout

    if (
      service.TargetSecuritySystemState !== undefined &&
      service.TargetSecuritySystemStateOperationStart !== undefined
    ) {
      let elapsedTime = Date.now() - service.TargetSecuritySystemStateOperationStart;
      this.log.debug(
        'INFO - CheckTimeout / result : ' + result + ' - elapsedTime : ' + elapsedTime
      );
      if (elapsedTime > this.maxWaitTimeForOperation * 1000) {
        return true;
      }
    }

    return false;
  },
};
