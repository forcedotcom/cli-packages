# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.1.3](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.1.1...@salesforce/command@3.1.3) (2021-06-04)


### Bug Fixes

* publish using npm automation token ([9b5e8ad](https://github.com/forcedotcom/cli-packages/commit/9b5e8adbc84fa38c31eafb1ee7a8d5fef2fbf15b))





## [3.1.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.1.0...@salesforce/command@3.1.1) (2021-06-03)


### Bug Fixes

* bump core version in command ([dcaf37c](https://github.com/forcedotcom/cli-packages/commit/dcaf37cc5c47713b3f24c365b1c434db036dc9a9))





# [3.1.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.0.5...@salesforce/command@3.1.0) (2021-01-22)


### Bug Fixes

* shared code/tests for custom array delimiter ([3c6074f](https://github.com/forcedotcom/cli-packages/commit/3c6074f92d0d3ceefc5ad9c7095df5d08502d1cc))


### Features

* array flags trim whitespace ([0e08d55](https://github.com/forcedotcom/cli-packages/commit/0e08d55abc6c5201e249f1b3219dd4b38167c6b4))





## [3.0.5](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.0.4...@salesforce/command@3.0.5) (2020-11-13)

**Note:** Version bump only for package @salesforce/command





## [3.0.4](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.0.3...@salesforce/command@3.0.4) (2020-11-11)

**Note:** Version bump only for package @salesforce/command





## [3.0.3](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.0.2...@salesforce/command@3.0.3) (2020-09-03)


### Bug Fixes

* message changes ([7cfc99a](https://github.com/forcedotcom/cli-packages/commit/7cfc99a))





## [3.0.2](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.0.1...@salesforce/command@3.0.2) (2020-09-03)


### Bug Fixes

* wrap AuthInfoCreationError ([d8e9766](https://github.com/forcedotcom/cli-packages/commit/d8e9766))





## [3.0.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@3.0.0...@salesforce/command@3.0.1) (2020-07-06)


### Bug Fixes

* updates buildArray to handle various comma separated arrangements ([c34c675](https://github.com/forcedotcom/cli-packages/commit/c34c675))





# [3.0.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.2.0...@salesforce/command@3.0.0) (2020-02-07)


### Features

* change json errors to stdout ([87d80c8](https://github.com/forcedotcom/cli-packages/commit/87d80c8))


### BREAKING CHANGES

* Moving json errors to stdout instead of stderr may break some tests or scripts
expecting it to be in stderr.

@W-5490315@





# [2.2.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.1.5...@salesforce/command@2.2.0) (2020-01-31)


### Features

* add oclif parameters to ux.startSpinner [#268](https://github.com/forcedotcom/cli-packages/issues/268) ([cfe5ef8](https://github.com/forcedotcom/cli-packages/commit/cfe5ef8))





## [2.1.5](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.1.4...@salesforce/command@2.1.5) (2020-01-29)


### Bug Fixes

* **error:** removed logic preventing correct error ([d92d691](https://github.com/forcedotcom/cli-packages/commit/d92d691))





## [2.1.4](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.1.3...@salesforce/command@2.1.4) (2020-01-07)


### Bug Fixes

* respect SFDX_CONTENT_TYPE=JSON ([554f2bf](https://github.com/forcedotcom/cli-packages/commit/554f2bf))





## [2.1.3](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.1.2...@salesforce/command@2.1.3) (2019-11-04)


### Bug Fixes

* poke circle ([849640d](https://github.com/forcedotcom/cli-packages/commit/849640d))





## [2.1.2](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.1.1...@salesforce/command@2.1.2) (2019-11-04)

**Note:** Version bump only for package @salesforce/command





## [2.1.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.1.0...@salesforce/command@2.1.1) (2019-11-04)

**Note:** Version bump only for package @salesforce/command





# [2.1.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@2.0.0...@salesforce/command@2.1.0) (2019-07-17)


### Features

* updating core ([cd4e6b0](https://github.com/forcedotcom/cli-packages/commit/cd4e6b0))
* upgrade core ([4696c5f](https://github.com/forcedotcom/cli-packages/commit/4696c5f))





# [2.0.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.5.3...@salesforce/command@2.0.0) (2019-06-18)


### Bug Fixes

* 🐛 Support new AuthInfo changes in core ([3dd191a](https://github.com/forcedotcom/cli-packages/commit/3dd191a))


### BREAKING CHANGES

* 🧨 Yes AuthInfo object is not backward compatible.





## [1.5.3](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.5.2...@salesforce/command@1.5.3) (2019-06-12)


### Bug Fixes

* instanceof isn’t detecting come instances of SfdxError ([092b311](https://github.com/forcedotcom/cli-packages/commit/092b311))
* respect --json when created outside of SfdxCommand flow ([f51563c](https://github.com/forcedotcom/cli-packages/commit/f51563c))





## [1.5.2](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.5.1...@salesforce/command@1.5.2) (2019-05-31)


### Bug Fixes

* remove dependency on log statement in oclif/command ([162b418](https://github.com/forcedotcom/cli-packages/commit/162b418))





## [1.5.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.5.0...@salesforce/command@1.5.1) (2019-05-03)


### Bug Fixes

* add deprecation warnings for commands and flags ([be56485](https://github.com/forcedotcom/cli-packages/commit/be56485))
* allow uppercase loglevel values ([51e5942](https://github.com/forcedotcom/cli-packages/commit/51e5942))
* put spaces between words in generated table col labels ([5481927](https://github.com/forcedotcom/cli-packages/commit/5481927))





# [1.5.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.4.2...@salesforce/command@1.5.0) (2019-04-04)


### Bug Fixes

* fix breaking behaviour with warnings being an object ([4db7416](https://github.com/forcedotcom/cli-packages/commit/4db7416))


### Features

* declarative flag validations ([e3077b5](https://github.com/forcedotcom/cli-packages/commit/e3077b5))





## [1.4.2](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.4.1...@salesforce/command@1.4.2) (2019-03-26)


### Bug Fixes

* init ux in catch ([1701a9d](https://github.com/forcedotcom/cli-packages/commit/1701a9d))





## [1.4.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.4.0...@salesforce/command@1.4.1) (2019-03-25)


### Bug Fixes

* use apiversion flags ([98d2971](https://github.com/forcedotcom/cli-packages/commit/98d2971))





# [1.4.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.3.4...@salesforce/command@1.4.0) (2019-03-22)


### Features

* allow massaging of result object printing by command ([84c2bc8](https://github.com/forcedotcom/cli-packages/commit/84c2bc8))





## [1.3.4](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.3.3...@salesforce/command@1.3.4) (2019-03-19)


### Bug Fixes

* remove hidden flags from docopts' ([c55fddc](https://github.com/forcedotcom/cli-packages/commit/c55fddc))
* support exclusive on both flags ([014274d](https://github.com/forcedotcom/cli-packages/commit/014274d))
* update core for security ([3d483a2](https://github.com/forcedotcom/cli-packages/commit/3d483a2))





## [1.3.3](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.3.2...@salesforce/command@1.3.3) (2019-03-18)


### Bug Fixes

* send the flags and varargs as part of the cmdError event ([e2d5c2b](https://github.com/forcedotcom/cli-packages/commit/e2d5c2b))
* support SFDX_JSON_TO_STDOUT ([d4b0062](https://github.com/forcedotcom/cli-packages/commit/d4b0062))





## [1.3.2](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.3.1...@salesforce/command@1.3.2) (2019-03-14)


### Bug Fixes

* add support for command error analytics ([22d94cc](https://github.com/forcedotcom/cli-packages/commit/22d94cc))





## [1.3.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.3.0...@salesforce/command@1.3.1) (2019-03-11)


### Bug Fixes

* keep varargs protected ([d3f71a5](https://github.com/forcedotcom/cli-packages/commit/d3f71a5))





# [1.3.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.2.0...@salesforce/command@1.3.0) (2019-03-05)


### Bug Fixes

* fix varargs docopt ([4e767e8](https://github.com/forcedotcom/cli-packages/commit/4e767e8))
* logical enforcement of `options` in `array` flag configs ([0e2bbc3](https://github.com/forcedotcom/cli-packages/commit/0e2bbc3)), closes [#30](https://github.com/forcedotcom/cli-packages/issues/30)
* loglevel flag should show a default ([91624a8](https://github.com/forcedotcom/cli-packages/commit/91624a8))


### Features

* wip for docopts ([11a4012](https://github.com/forcedotcom/cli-packages/commit/11a4012))





# [1.2.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.1.1...@salesforce/command@1.2.0) (2018-12-21)


### Bug Fixes

* update kit, ts-types, ts-sinon versions ([9505744](https://github.com/forcedotcom/cli-packages/commit/9505744))


### Features

* allow duration bounds to accept duration ([30557e2](https://github.com/forcedotcom/cli-packages/commit/30557e2))
* support deprecation and legacy flag props ([9c20954](https://github.com/forcedotcom/cli-packages/commit/9c20954))





## [1.1.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.1.0...@salesforce/command@1.1.1) (2018-12-13)


### Bug Fixes

* allow partial for builtin options ([6462367](https://github.com/forcedotcom/cli-packages/commit/6462367))





# [1.1.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.0.2...@salesforce/command@1.1.0) (2018-12-13)


### Features

* add optional min/max numeric flag validations ([484cf1e](https://github.com/forcedotcom/cli-packages/commit/484cf1e))
* set correct this type type on SfdxResult.display ([fe9357f](https://github.com/forcedotcom/cli-packages/commit/fe9357f))





## [1.0.2](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@1.0.1...@salesforce/command@1.0.2) (2018-12-04)

### Bug Fixes

- find in test code ([1496b26](https://github.com/forcedotcom/cli-packages/commit/1496b26))

## [1.0.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/command@0.4.0...@salesforce/command@1.0.1) (2018-12-04)

### Bug Fixes

- update package.json ([e517e6c](https://github.com/forcedotcom/cli-packages/commit/e517e6c))

# 0.4.0 (2018-12-03)

### Bug Fixes

- add duration flag types in place of time ([cc984b5](https://github.com/forcedotcom/cli-packages/commit/cc984b5))
- broken test ([f9a5ba7](https://github.com/forcedotcom/cli-packages/commit/f9a5ba7))
- compiler error ([e88f3fc](https://github.com/forcedotcom/cli-packages/commit/e88f3fc))
- no spinner for json parameter; fix this data type for SfdxResult display ([#3](https://github.com/forcedotcom/cli-packages/issues/3)) ([0488b89](https://github.com/forcedotcom/cli-packages/commit/0488b89))
- support for typed array value mapping ([d630cca](https://github.com/forcedotcom/cli-packages/commit/d630cca))
- update core and dev-config ([8e4785a](https://github.com/forcedotcom/cli-packages/commit/8e4785a))
- update core reference. ([d7f5042](https://github.com/forcedotcom/cli-packages/commit/d7f5042))
- update package.json ([ae2a5ae](https://github.com/forcedotcom/cli-packages/commit/ae2a5ae))
- validate duration flag types ([c682117](https://github.com/forcedotcom/cli-packages/commit/c682117))

### Features

- port over command to cli-packages ([2d45302](https://github.com/forcedotcom/cli-packages/commit/2d45302))
- update core and other deps ([e39a8e7](https://github.com/forcedotcom/cli-packages/commit/e39a8e7))
