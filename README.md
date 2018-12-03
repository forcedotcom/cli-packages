[![CircleCI](https://circleci.com/gh/forcedotcom/cli-packages.svg?style=svg&circle-token=c0b10c691c5b68284d942f3f8bde7e281b0f31a8)](https://circleci.com/gh/forcedotcom/cli-packages)

# Description

This repository contains (or will contain) the core Salesforce CLI, the base command, and core plug-ins.

# Packages

Currently, we have the following packages:

## [@salesforce/command](https://www.npmjs.com/package/@salesforce/command) - The Salesforce CLI base command

- [![NPM](https://img.shields.io/npm/v/@salesforce/command.svg)](https://www.npmjs.com/package/@salesforce/command)
- Learn more in its [README](https://github.com/forcedotcom/cli-packages/blob/develop/packages/command/README.md).
- See the code at [packages/command](https://github.com/forcedotcom/cli-packages/blob/develop/packages/command).
- Read the [API docs](https://forcedotcom.github.io/cli-packages/command).

# Contributing

If you are interested in contributing, please take a look at the [CONTRIBUTING](https://github.com/forcedotcom/cli-packages/blob/develop/CONTRIBUTING.md) guide.

# Development

If you are interested in building these packages locally, please take a look at the [DEVELOPING](https://github.com/forcedotcom/cli-packages/blob/develop/DEVELOPING.md) doc.

# Related Docs and Repositories

- [@salesforce/command](https://github.com/forcedotcom/cli-packages/tree/master/packages/command) - Contains the base Salesforce CLI command, `SfdxCommand`.
- [@oclif/command](https://github.com/oclif/command) - Base oclif `Command`, which `SfdxCommand` extends.
- [@salesforce/plugin-generator](https://github.com/forcedotcom/sfdx-plugin-generate) - The generator plug-in for building plug-ins for Salesforce CLI.
