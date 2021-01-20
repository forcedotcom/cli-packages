# Developing

## Pre-requisites

1. We use the active NodeJS LTS. If you need to work with multiple versions of Node, you
   might consider using [nvm](https://github.com/creationix/nvm).
1. This repository uses [yarn](https://yarnpkg.com/) to manage node dependencies. Please install yarn globally using `npm install --global yarn`.
1. Tests are executed on the latest NodeJS as well as all active and maintained NodeJS LTS versions.

## Structure

### Packages

The packages directory contains the different npm packages.

## Typical workflow

You would only do this once after you cloned the repository.

1. Clone this repository from git.
1. `cd` into `sfdx-dev-packages`.
1. We develop using feature brances off `main` and release from the `main` branch. At
   this point, it should be set to `main` by default. If not, run `git checkout -t origin/main`.
1. `yarn` to bring in all the top-level dependencies.
1. `yarn bootstrap` to setup and link all packages.
1. Open the project in your editor of choice.

## When you are ready to commit

1. We enforce commit message format. We recommend using [commitizen](https://github.com/commitizen/cz-cli) by installing it with `yarn global add commitizen` then commit using `git cz` which will prompt you questions to format the commit message.
1. Before commit and push, husky will run several hooks to ensure the message and that everything lints and compiles properly.

## List of Useful commands

_These commands assume that they are executed from the top-level directory.
Internally, they delegate to `lerna` to call them on each npm module in the
packages directory._

### `yarn bootstrap`

This bootstraps the packages by issuing an `yarn install` on each package and
also symlinking any package that are part of the packages folder.

You would want do this as the first step after you have made changes in the
modules.

If you change the dependencies in your package.json, you will also need to run
this command.

### `yarn compile`

This runs `yarn compile` on each of the package in packages.

### `yarn clean`

This run `yarn clean` on each of the package in packages. Running `yarn clean-all` will also clean up the node_module directories.

### `yarn test`

This runs `yarn test` on each of the packages.

### `yarn lint`

This runs `yarn lint` on each of the packages. If there are no errors/warnings
from tslint, then you get a clean output. But, if they are errors from tslint,
you will see a long error that can be confusing – just focus on the tslint
errors. The results of this is deeper than what the tslint extension in VS Code
does because of [semantic lint
rules](https://palantir.github.io/tslint/usage/type-checking/) which requires a
tsconfig.json to be passed to tslint.
