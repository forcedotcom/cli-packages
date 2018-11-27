/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags as Flags } from '@oclif/command';
import { EnumFlagOptions, IOptionFlag } from '@oclif/parser/lib/flags';
import { Logger, Messages, sfdc, SfdxError } from '@salesforce/core';
import { toNumber } from '@salesforce/kit';
import { Dictionary, ensure, isArray, isFunction, isString } from '@salesforce/ts-types';
import { URL } from 'url';

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('@salesforce/command', 'flags');

export type SfdxFlagParser = (val: string) => string;

const FLAGS: Readonly<Dictionary<SfdxFlagDefinition>> = {
  // required by all commands
  json: {
    description: messages.getMessage('jsonFlagDescription'),
    longDescription: messages.getMessage('jsonFlagLongDescription'),
    required: false,
    type: 'boolean'
  },
  loglevel: {
    description: messages.getMessage('loglevelFlagDescription'),
    longDescription: messages.getMessage('loglevelFlagLongDescription'),
    required: false,
    options: Logger.LEVEL_NAMES,
    type: 'enum'
  },
  // supported by SOME commands
  // to include in --help, register flag in flagsConfig, eg { verbose: true }; include
  // description and longDescription to override default descriptions
  apiversion: {
    description: messages.getMessage('apiversionFlagDescription'),
    longDescription: messages.getMessage('apiversionFlagLongDescription'),
    parse: (val: string) => {
      if (sfdc.validateApiVersion(val)) return val;
      throw SfdxError.create('@salesforce/command', 'flags', 'InvalidApiVersionError', [val]);
    },
    required: false,
    type: 'string'
  },
  concise: {
    description: messages.getMessage('conciseFlagDescription'),
    longDescription: messages.getMessage('conciseFlagLongDescription'),
    required: false,
    type: 'boolean'
  },
  quiet: {
    description: messages.getMessage('quietFlagDescription'),
    longDescription: messages.getMessage('quietFlagLongDescription'),
    required: false,
    type: 'boolean'
  },
  targetusername: {
    char: 'u',
    description: messages.getMessage('targetusernameFlagDescription'),
    longDescription: messages.getMessage('targetusernameFlagLongDescription'),
    required: false,
    type: 'string'
  },
  targetdevhubusername: {
    char: 'v',
    description: messages.getMessage('targetdevhubusernameFlagDescription'),
    longDescription: messages.getMessage('targetdevhubusernameFlagLongDescription'),
    required: false,
    type: 'string'
  },
  verbose: {
    description: messages.getMessage('verboseFlagDescription'),
    longDescription: messages.getMessage('verboseFlagLongDescription'),
    required: false,
    type: 'boolean'
  }
};

// TODO: Ideally we'd get the oclif flag type and ours perfectly married, but apparently that's not a simple task...
// ...in particular, IFlag seems to only allow type property values of `boolean` or `option`.
// export type SfdxFlagDefinition = Partial<Flags.IFlag<any>> & { longDescription: string };
// tslint:disable-next-line:no-any
export type SfdxFlagDefinition = Dictionary<any>;

export type SfdxFlag = SfdxFlagDefinition | string | boolean;

// Consumers can turn on/off SFDX flags or override certain flags.
export interface SfdxFlagsConfig extends Dictionary<SfdxFlag> {}

function validateType(isValid: boolean, path: string, flagType: string, correct?: string) {
  if (isValid) {
    return path;
  }
  throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [path, flagType, correct || '']);
}

interface SfdxFlagValidator {
  parse: SfdxFlagParser;
}

// type SfdxBooleanFlag = Partial<IBooleanFlag<boolean> & { longDescription: string }>;
// type SfdxOptionFlag<T> = Partial<IOptionFlag<T> & { longDescription: string }>;

// type SfdxFlagOptions<T> = Partial<(IBooleanFlag<boolean> | IOptionFlag<T>) & { longDescription: string }>;

// const sfdxFlags = {
//   json(): SfdxBooleanFlag {
//     const jsonFlag = Flags.boolean({
//       description: messages.getMessage('jsonFlagDescription'),
//       required: false
//     });
//     return { ...jsonFlag, longDescription: messages.getMessage('jsonFlagLongDescription') };
//   },
//   array(options: SfdxOptionFlag<string[]> = {}): SfdxOptionFlag<string[]> {
//     const parse = (val: string) => {
//       validateType(!!val.split(','), val, 'array');
//       return val.split(',');
//     };
//     const arrayFlag = Flags.build(Object.assign(options, { parse }))();
//     return arrayFlag;
//   },
//   date(options: SfdxFlagOptions = {}) {},
//   id(options: SfdxFlagOptions = {}) {},
//   number(options: SfdxFlagOptions = {}) {},
//   override(options: SfdxFlagOptions = {}) {}
// };

const FLAGTYPES: Readonly<Dictionary<SfdxFlagValidator>> = {
  array: {
    parse: (val: string) => validateType(!!val.split(','), val, 'array')
  },
  date: {
    parse: (val: string) =>
      validateType(!!Date.parse(val), val, 'date', ` ${messages.getMessage('FormattingMessageDate')}`)
  },
  datetime: {
    parse: (val: string) =>
      validateType(!!Date.parse(val), val, 'datetime', ` ${messages.getMessage('FormattingMessageDate')}`)
  },
  directory: {
    parse: (val: string) => validateType(sfdc.validatePathDoesNotContainInvalidChars(val), val, 'directory')
  },
  email: {
    parse: (val: string) => validateType(sfdc.validateEmail(val), val, 'email')
  },
  filepath: {
    parse: (val: string) => validateType(sfdc.validatePathDoesNotContainInvalidChars(val), val, 'filepath')
  },
  id: {
    parse: (val: string) =>
      validateType(sfdc.validateSalesforceId(val), val, 'id', ` ${messages.getMessage('FormattingMessageId')}`)
  },
  number: {
    parse: (val: string) => validateType(isFinite(toNumber(val)), val, 'number')
  },
  time: {
    parse: (val: string) => {
      const dateVal = new Date(`2000-01-02 ${val}`);
      return validateType(!!Date.parse(dateVal.toDateString()), val, 'time');
    }
  },
  url: {
    parse: (val: string) => {
      let isValid;
      try {
        isValid = new URL(val);
      } catch (err) {
        isValid = false;
      }
      return validateType(!!isValid, val, 'url', ` ${messages.getMessage('FormattingMessageUrl')}`);
    }
  }
};

/**
 * Builds a custom flag; parses and validates Salesforce supported flag types. E.g., { type: 'filepath' }. These include:
 *      1. array: a comma-separated list of strings, E.g., "one,two,three"
 *      2. date, datetime: a valid date, E.g., "01-02-2000" or "01/02/2000 01:02:34"
 *      3. directory, filepath: see {SfdxUtil.validatePathDoesNotContainInvalidChars}, E.g. "this/is/my/path"
 *      4. email: see {SfdxUtil.validateEmail}, E.g., "me@my.org"
 *      5. id: see {SfdxUtil.validateSalesforceId}, E.g., "00Dxxxxxxxxxxxx"
 *      6. number: an integer or floating point number, E.g., "42"
 *      7. time: a valid time, E.g., "01:02:03"
 *      8. url: a valid url, E.g., "http://www.salesforce.com"
 * @param {Flags.Output} flag The flag configuration.
 * @returns {Flags.Input<any} The flag for the command.
 */
function buildCustomFlag(flag: Flags.Output) {
  return FLAGTYPES[flag.type] ? Flags.build(flag)(FLAGTYPES[flag.type]) : Flags.build(flag)();
}

/**
 * Validate the custom flag configuration. This includes:
 *      1. The flag name is in all lowercase.
 *      2. A string description is provided.
 *      3. If a char attribute is provided, it is one alphabetical character in length
 *      4. If a long description is provided, it is a string
 * @param {SfdxFlagDefinition} flag The flag configuration.
 * @param {string} key The flag name.
 * @throws SfdxError If the criteria is not meet.
 */
function validateCustomFlag(flag: SfdxFlagDefinition, key: string) {
  if (!/^(?!(?:[-]|[0-9]*$))[a-z0-9-]+$/.test(key)) {
    throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagName', [key]);
  }
  if (!flag.description || !isString(flag.description)) {
    throw SfdxError.create('@salesforce/command', 'flags', 'MissingOrInvalidFlagDescription', [key]);
  }
  if (flag.char && (flag.char.length !== 1 || !/[a-zA-Z]/.test(flag.char))) {
    throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagChar', [key]);
  }
  if (flag.longDescription !== undefined && !isString(flag.longDescription)) {
    throw SfdxError.create('@salesforce/command', 'flags', 'InvalidLongDescriptionFormat', [key]);
  }
}

/**
 *  Build a flag, taking either the name of an SFDX flag or a flag definition.
 *  Uses the type in the definition if there is a builder for it, otherwise
 *  it builds a custom flag.
 * @param {string | SfdxFlagsConfig} flag The name of an SFDX flag or a flag configuration.
 * @param {string} [key] The flag name.
 * @returns {Flags.Input<any} The flag for the command.
 */
function buildFlag(flag: string | SfdxFlagDefinition, key?: string) {
  const f = isString(flag) ? ensure(FLAGS[flag]) : flag;
  // Validate custom flags only; SFDX flags unnecessary
  if (key) {
    validateCustomFlag(f, key);
  }
  switch (f.type) {
    case 'boolean':
      return Flags.boolean(f);
    case 'enum':
      return isEnumFlag(f) ? Flags.enum(f) : buildCustomFlag(f);
    case 'option':
      return isOptionFlag(f) ? Flags.option(f) : buildCustomFlag(f);
    case 'string':
      return Flags.string(f);
    default:
      return buildCustomFlag(f);
  }
}

// tslint:disable-next-line:no-any
const isEnumFlag = (f: SfdxFlagDefinition): f is EnumFlagOptions<any> => {
  return f.type === 'enum' && isArray(f.options);
};

// tslint:disable-next-line:no-any
const isOptionFlag = (f: SfdxFlagDefinition): f is IOptionFlag<any> => {
  return f.type === 'option' && isFunction(f.parse);
};

/**
 * Builds flags for a command given a configuration object.  Supports the following use cases:
 *     1. Enabling common SFDX flags. E.g., { verbose: true }
 *     2. Disabling common SFDX flags. E.g., { apiversion: false }
 *     3. Overriding common SFDX flags.  E.g., { targetusername: { required: true } }
 *     4. Defining typed flags.  E.g., { myFlag: { char: '-m', type: 'array' }}
 *     5. Defining oclif flags.  E.g., { myFlag: Flags.boolean({ char: '-f' }) }
 *     6. Defining custom flag types.  E.g., { myCustomFlag: { parse: (val) => parseInt(val, 10) }}
 *
 * @param {SfdxFlagsConfig} flagsConfig The configuration object for a flag.  @see {@link SfdxFlagsConfig}
 * @returns {Flags.Input<any} The flags for the command.
 */
export function buildSfdxFlags(
  flagsConfig: SfdxFlagsConfig = {}
  // tslint:disable-next-line no-any (matches oclif)
): Flags.Input<any> {
  // The default flag options for SFDX commands.
  // tslint:disable-next-line no-any (matches oclif)
  const DEFAULT_SFDX_FLAGS: Flags.Input<any> = {
    json: buildFlag('json'),
    loglevel: buildFlag('loglevel')
  };

  return Object.entries(flagsConfig).reduce((flags, [key, val]) => {
    // All commands MUST support json and loglevel flags
    if (key === 'json' || key === 'loglevel') {
      return flags;
    } else if (val === false) {
      // Turn off the flag
      delete flags[key];
    } else if (val === true) {
      // Turn on the flag if it's a known SFDX flag
      if (FLAGS[key]) {
        flags[key] = buildFlag(key);
      } else {
        throw SfdxError.create('@salesforce/command', 'flags', 'UnknownFlagError', [key]);
      }
    } else {
      // Add the command-defined flag config
      const flag = ensure(FLAGS[key] ? Object.assign({}, FLAGS[key], val) : val);
      flags[key] = buildFlag(flag, key);
    }
    return flags;
  }, DEFAULT_SFDX_FLAGS);
}
