# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.5](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@2.0.4...@salesforce/telemetry@2.0.5) (2021-01-22)

**Note:** Version bump only for package @salesforce/telemetry





## [2.0.4](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@2.0.3...@salesforce/telemetry@2.0.4) (2020-11-13)

**Note:** Version bump only for package @salesforce/telemetry





## [2.0.3](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@2.0.2...@salesforce/telemetry@2.0.3) (2020-11-11)

**Note:** Version bump only for package @salesforce/telemetry





## [2.0.2](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@2.0.1...@salesforce/telemetry@2.0.2) (2020-03-02)


### Bug Fixes

* check connection to app insights ([d4d5748](https://github.com/forcedotcom/cli-packages/commit/d4d5748))





## [2.0.1](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@2.0.0...@salesforce/telemetry@2.0.1) (2020-01-31)


### Bug Fixes

* add old envar for backwards compatability ([8a86933](https://github.com/forcedotcom/cli-packages/commit/8a86933))
* use old envar for backwards support ([a2fb4b4](https://github.com/forcedotcom/cli-packages/commit/a2fb4b4))





# [2.0.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@1.3.0...@salesforce/telemetry@2.0.0) (2020-01-29)


### Bug Fixes

* add ability to override gdpr keys ([183282a](https://github.com/forcedotcom/cli-packages/commit/183282a))
* cache config and add static for consumers to call ([ab2a5c0](https://github.com/forcedotcom/cli-packages/commit/ab2a5c0))
* **gdpr:** adds logic to clear gdpr sentive tags + test ([5e55c88](https://github.com/forcedotcom/cli-packages/commit/5e55c88))


### Features

* remove forked process in favor or dispose ([b997f5e](https://github.com/forcedotcom/cli-packages/commit/b997f5e))


### BREAKING CHANGES

* Refactor/remove the telemetry signatures. Remove the forked process. Requires a





# [1.3.0](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@1.2.5...@salesforce/telemetry@1.3.0) (2020-01-13)


### Bug Fixes

* alias telemetry types as TelemetryData ([b7e05ff](https://github.com/forcedotcom/cli-packages/commit/b7e05ff))
* fix merge error ([b1be6bd](https://github.com/forcedotcom/cli-packages/commit/b1be6bd))
* flag type when passing data to child process ([0e5204b](https://github.com/forcedotcom/cli-packages/commit/0e5204b))
* misspelled 'exception' ([088b604](https://github.com/forcedotcom/cli-packages/commit/088b604))
* refactor common logic to new function ([1bd097e](https://github.com/forcedotcom/cli-packages/commit/1bd097e))
* use config var to opt out of telemetry ([2f0360d](https://github.com/forcedotcom/cli-packages/commit/2f0360d))


### Features

* add more telemetry types for AppInsights ([7456912](https://github.com/forcedotcom/cli-packages/commit/7456912))





## [1.2.5](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@1.2.4...@salesforce/telemetry@1.2.5) (2019-11-04)


### Bug Fixes

* poke circle ([849640d](https://github.com/forcedotcom/cli-packages/commit/849640d))





## [1.2.4](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@1.2.3...@salesforce/telemetry@1.2.4) (2019-11-04)

**Note:** Version bump only for package @salesforce/telemetry





## [1.2.3](https://github.com/forcedotcom/cli-packages/compare/@salesforce/telemetry@1.2.2...@salesforce/telemetry@1.2.3) (2019-11-04)

**Note:** Version bump only for package @salesforce/telemetry





## [1.2.2](https://github.com/forcedotcom/sfdx-telemetry/compare/@salesforce/telemetry@1.2.1...@salesforce/telemetry@1.2.2) (2019-08-08)


### Bug Fixes

* spawn telemetry reporter in separate process ([5fa3345](https://github.com/forcedotcom/sfdx-telemetry/commit/5fa3345))





## [1.2.1](https://github.com/forcedotcom/sfdx-telemetry/compare/@salesforce/telemetry@1.2.0...@salesforce/telemetry@1.2.1) (2019-08-01)


### Bug Fixes

* prettier ([119b1e5](https://github.com/forcedotcom/sfdx-telemetry/commit/119b1e5))
* prettier updates ([735ee52](https://github.com/forcedotcom/sfdx-telemetry/commit/735ee52))
* provide the ability to opt out of insights ([50debf0](https://github.com/forcedotcom/sfdx-telemetry/commit/50debf0))
* remove nested if ([774ae02](https://github.com/forcedotcom/sfdx-telemetry/commit/774ae02))





# [1.2.0](https://github.com/forcedotcom/sfdx-telemetry/compare/@salesforce/telemetry@1.1.0...@salesforce/telemetry@1.2.0) (2019-07-17)


### Bug Fixes

* telemetry test coverage ([0cb7c39](https://github.com/forcedotcom/sfdx-telemetry/commit/0cb7c39))


### Features

* updating core ([cd4e6b0](https://github.com/forcedotcom/sfdx-telemetry/commit/cd4e6b0))
* upgrade core ([4696c5f](https://github.com/forcedotcom/sfdx-telemetry/commit/4696c5f))





# 1.1.0 (2019-07-16)


### Bug Fixes

* adjust water mark ([6c4f213](https://github.com/forcedotcom/sfdx-telemetry/commit/6c4f213))
* lodash security warning ([d6a7f69](https://github.com/forcedotcom/sfdx-telemetry/commit/d6a7f69))
* update test tsconfig ([3773864](https://github.com/forcedotcom/sfdx-telemetry/commit/3773864))


### Features

* new telemetry project ([d29f0c5](https://github.com/forcedotcom/sfdx-telemetry/commit/d29f0c5))
