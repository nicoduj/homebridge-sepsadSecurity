# homebridge-sepsadSecurity

[![npm](https://img.shields.io/npm/v/homebridge-sepsadSecurity.svg)](https://www.npmjs.com/package/homebridge-sepsadSecurity)
[![npm](https://img.shields.io/npm/dw/homebridge-sepsadSecurity.svg)](https://www.npmjs.com/package/homebridge-sepsadSecurity)
[![npm](https://img.shields.io/npm/dt/homebridge-sepsadSecurity.svg)](https://www.npmjs.com/package/homebridge-sepsadSecurity)

[![CodeFactor](https://www.codefactor.io/repository/github/nicoduj/homebridge-sepsadSecurity/badge)](https://www.codefactor.io/repository/github/nicoduj/homebridge-sepsadSecurity)
[![Build Status](https://travis-ci.com/nicoduj/homebridge-sepsadSecurity.svg?branch=master)](https://travis-ci.com/nicoduj/homebridge-sepsadSecurity)
[![Known Vulnerabilities](https://snyk.io/test/github/nicoduj/homebridge-sepsadSecurity/badge.svg?targetFile=package.json)](https://snyk.io/test/github/nicoduj/homebridge-sepsadSecurity?targetFile=package.json)
[![Greenkeeper badge](https://badges.greenkeeper.io/nicoduj/homebridge-sepsadSecurity.svg)](https://greenkeeper.io/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Plugin for controlling your [sepsad security system](https://www.sepsad-telesurveillance.fr/telesurveillance-integrale.aspx) from [Sepsad](https://www.sepsad-telesurveillance.fr) through [HomeBridge](https://github.com/nfarina/homebridge) .

Might also work with [EPS] system since they seemed to be using same technical architecture (only rebranding).

It was tested on my personnal installation which is nearly 4 years old so might not be working with latest installations ...

**_ !!!! IMPORTANT !!! _**
**_ PLEASE NOTE THAT SINCE DEACTVATING ISN OT ALLOWED THROUGH API, IT WON'T BE POSSIBLE TO DEACTIVATE THE SYSTEM THROUGH THE PLUGIN / HOMEBRIDGE _**
**_ !!!! IMPORTANT !!! _**

`npm install -g homebridge-sepsadSecurity`

## Homebridge configuration

Config as below:

```json
"platforms": [
  {
    "platform": "HomebridgeSepsadSecurity",
    "login": "123456",
	  "password": "toto"
  }
]
```

Fields:

- `platform` must be "HomebridgeSepsadSecurity" (required).
- `login` login used for your sepsad account (required).
- `password` password of your sepsad account (required).
- `refreshTimer` Optional - enable refresh of security System state every X seconds, for automation purpose if you need to activate something else based on its state change (defaults : disable, accepted range : 60-3600s).

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
