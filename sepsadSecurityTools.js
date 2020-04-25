module.exports = {
  checkTimer: function (timer) {
    if (timer && timer > 0 && (timer < 30 || timer > 600)) return 180;
    else return timer;
  },

  checkParemeter: function (parameter, min, max, def) {
    if (parameter == undefined || parameter < min || parameter > max) return def;
    else return parameter;
  },

  checkBoolParameter: function (parameter, def) {
    if (parameter == undefined) {
      return def;
    } else {
      if (typeof parameter === 'string') {
        switch (parameter.toLowerCase().trim()) {
          case 'true':
          case 'yes':
            return true;
          case 'false':
          case 'no':
          case null:
            return false;
          default:
            return parameter;
        }
      } else {
        return parameter;
      }
    }
  },
};
