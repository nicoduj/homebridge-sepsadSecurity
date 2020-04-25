# homebridge-sepsadSecurity

[![npm](https://img.shields.io/npm/v/homebridge-sepsadSecurity.svg)](https://www.npmjs.com/package/homebridge-sepsadSecurity)
[![npm](https://img.shields.io/npm/dw/homebridge-sepsadSecurity.svg)](https://www.npmjs.com/package/homebridge-sepsadSecurity)
[![npm](https://img.shields.io/npm/dt/homebridge-sepsadSecurity.svg)](https://www.npmjs.com/package/homebridge-sepsadSecurity)

[![CodeFactor](https://www.codefactor.io/repository/github/nicoduj/homebridge-sepsadSecurity/badge)](https://www.codefactor.io/repository/github/nicoduj/homebridge-sepsadSecurity)
[![Build Status](https://travis-ci.com/nicoduj/homebridge-sepsadSecurity.svg?branch=master)](https://travis-ci.com/nicoduj/homebridge-sepsadSecurity)
[![Known Vulnerabilities](https://snyk.io/test/github/nicoduj/homebridge-sepsadSecurity/badge.svg?targetFile=package.json)](https://snyk.io/test/github/nicoduj/homebridge-sepsadSecurity?targetFile=package.json)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Plugin for controlling your [sepsad security system](https://www.sepsad-telesurveillance.fr/telesurveillance-integrale.aspx) from [Sepsad](https://www.sepsad-telesurveillance.fr) through [HomeBridge](https://github.com/nfarina/homebridge) .

Might also work with [EPS] system since they seemed to be using same technical architecture (only rebranding).

It was tested on my personnal installation which is nearly 4 years old so might not be working with latest installations ...

**_ !!!! IMPORTANT !!! _**
**_ PLEASE NOTE THAT SINCE DEACTVATING IS NOT ALLOWED THROUGH API, IT WON'T BE POSSIBLE TO DEACTIVATE THE SYSTEM THROUGH THE PLUGIN / HOMEBRIDGE _**
**_ so defautl option to activate is off _**
**_ !!!! IMPORTANT !!! _**

`npm install -g homebridge-sepsadSecurity`

## Homebridge configuration

Config as below:

```json
"platforms": [
  {
    "platform": "HomebridgeSepsadSecurity",
    "login": "123456",
    "password": "toto",
    "originSession": "SEPSAD",
    "allowActivation": false
  }
]
```

Fields:

- `platform` must be "HomebridgeSepsadSecurity" (required).
- `login` login used for your sepsad account (required).
- `password` password of your sepsad account (required).
- `originSession` defaults to "SEPSAD". Can try other values for EPS, might work who knows :)
- `refreshTimer` Optional - enable refresh of security System state every X seconds, for automation purpose if you need to activate something else based on its state change (defaults : disable, accepted range : 60-3600s).
- `maxWaitTimeForOperation` Optional - set the maximum time that we wait for operation to complete. When elapsed, check the current State again and updates accordingly. (defaults : 20s, accepted range : 30-90s).
- `refreshTimerDuringOperation` Optional - set the refresh timer during operation in progress to detect the end of the operation. (defaults : 5s, accepted range : 2-15s).
- `allowActivation` Optional - set to true if you want to allow activation of the system. **PLEASE READ IMPORTANT NOTE AT THE BEGINNING OF THIS README**
- `cleanCache` Set it to true in case you want to remove the cached accessory (only those from this plugin). You have to restart homebridge after applying the option. Remove it after restart, otherwise it will be recreated at each startup.

## Changelog

See [CHANGELOG][].

[changelog]: CHANGELOG.md

## Inspiration

Many thanks to :

- every tester / contributor that test, and give feedback in any way !

## Donating

Support this project and [others by nicoduj][nicoduj-projects] via [PayPal][paypal-nicoduj].

[![Support via PayPal][paypal-button]][paypal-nicoduj]

[nicoduj-projects]: https://github.com/nicoduj/
[paypal-button]: https://img.shields.io/badge/Donate-PayPal-green.svg
[paypal-nicoduj]: https://www.paypal.me/nicoduj/2.50

## License

As of Dec 01 2018, Nicolas Dujardin has released this repository and its contents to the public domain.

It has been released under the [UNLICENSE][].

[unlicense]: LICENSE
