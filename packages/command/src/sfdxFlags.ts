/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags as OclifFlags } from '@oclif/command';
import * as Parser from '@oclif/parser';
import { EnumFlagOptions, IBooleanFlag, IFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { Logger, Messages, sfdc, SfdxError } from '@salesforce/core';
import { toNumber } from '@salesforce/kit';
import { definiteEntriesOf, ensure, hasString, isKeyOf, isString, Optional } from '@salesforce/ts-types';
import { URL } from 'url';

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('@salesforce/command', 'flags');

function merge<T>(kind: flags.Kind, flag: IFlag<T>, describable: flags.Describable): flags.Discriminated<flags.Any<T>> {
  return {
    kind,
    ...flag,
    description: describable.description,
    longDescription: describable.longDescription
  };
}

function option<T>(
  kind: flags.Kind,
  options: flags.Option<T>,
  parse: (val: string) => T
): flags.Discriminated<flags.Option<T>> {
  return merge(kind, OclifFlags.build(Object.assign(options, { parse }))(), options);
}

export namespace flags {
  export type Array<T> = Option<T[]> & { delimiter?: string };
  export type Any<T> = Partial<OclifFlags.IFlag<T>> & Describable;
  export type BaseBoolean<T> = Partial<IBooleanFlag<T>>;
  export type Boolean<T> = BaseBoolean<T> & Describable;
  export type Builtin = { type: 'builtin' };
  export type DateTime = Option<Date>;
  export type Describable = { description: string; longDescription?: string };
  export type Discriminant = { kind: Kind };
  export type Discriminated<T> = T & Discriminant;
  export type Enum<T> = EnumFlagOptions<T> & Describable;
  export type Kind = keyof typeof flags;
  export type Input<T extends Parser.flags.Output> = OclifFlags.Input<T>;
  export type Number = Option<number>;
  export type Option<T> = Partial<IOptionFlag<Optional<T>>> & Describable;
  export type Output = OclifFlags.Output;
  export type String = Option<string>;
  export type Url = Option<URL>;
}

// oclif

function buildBoolean<T = boolean>(options: flags.Boolean<T>): flags.Discriminated<flags.Boolean<T>> {
  return merge('boolean', OclifFlags.boolean(options), options);
}

function buildEnum<T>(options: flags.Enum<T>): flags.Discriminated<flags.Enum<T>> {
  return {
    kind: 'enum',
    type: 'option',
    ...options,
    options: options.options,
    description: options.description,
    longDescription: options.longDescription
  };
}

function buildHelp(options: flags.BaseBoolean<boolean>): flags.Discriminated<flags.Boolean<void>> {
  const flag = OclifFlags.help(options);
  return merge('help', OclifFlags.help(options), {
    description: ensure(flag.description)
  });
}

function buildInteger(options: flags.Number): flags.Discriminated<flags.Number> {
  return merge('integer', OclifFlags.integer(options), options);
}

function buildOption<T>(
  options: { parse: (val: string, context: unknown) => T } & flags.Option<T>
): flags.Discriminated<flags.Option<T>> {
  return merge('option', OclifFlags.option(options), options);
}

function buildString(options: flags.String): flags.Discriminated<flags.String> {
  return merge('string', OclifFlags.string(options), options);
}

function buildVersion(options?: flags.BaseBoolean<boolean>): flags.Discriminated<flags.Boolean<void>> {
  const flag = OclifFlags.version(options);
  return merge('version', flag, {
    description: ensure(flag.description)
  });
}

// sfdx

function buildArray(options: flags.Array<string>): flags.Discriminated<flags.Array<string>>;
function buildArray<T>(options: flags.Array<T>, map: (val: string) => T): flags.Discriminated<flags.Array<T>>;
function buildArray<T>(options: flags.Array<T>, map?: (val: string) => T): flags.Discriminated<flags.Array<T>> {
  return option('array', options, val => {
    const vals = val.split(options.delimiter || ',');
    return map ? vals.map(map) : vals;
  });
}

function buildDate(options: flags.DateTime): flags.Discriminated<flags.DateTime> {
  return option('date', options, (val: string) => {
    const parsed = Date.parse(val);
    validateValue(!isNaN(parsed), val, 'date', ` ${messages.getMessage('FormattingMessageDate')}`);
    return new Date(parsed);
  });
}

function buildDatetime(options: flags.DateTime): flags.Discriminated<flags.DateTime> {
  return option('datetime', options, (val: string) => {
    const parsed = Date.parse(val);
    validateValue(!isNaN(parsed), val, 'datetime', ` ${messages.getMessage('FormattingMessageDate')}`);
    return new Date(parsed);
  });
}

function buildDirectory(options: flags.String): flags.Discriminated<flags.String> {
  return option('directory', options, (val: string) => {
    return validateValue(sfdc.validatePathDoesNotContainInvalidChars(val), val, 'directory');
  });
}

function buildEmail(options: flags.String): flags.Discriminated<flags.String> {
  return option('email', options, (val: string) => {
    return validateValue(sfdc.validateEmail(val), val, 'email');
  });
}

function buildFilepath(options: flags.String): flags.Discriminated<flags.String> {
  return option('filepath', options, (val: string) => {
    return validateValue(sfdc.validatePathDoesNotContainInvalidChars(val), val, 'filepath');
  });
}

function buildId(options: flags.String): flags.Discriminated<flags.String> {
  return option('id', options, (val: string) => {
    return validateValue(sfdc.validateSalesforceId(val), val, 'id', ` ${messages.getMessage('FormattingMessageId')}`);
  });
}

function buildNumber(options: flags.Number): flags.Discriminated<flags.Number> {
  return option('number', options, (val: string) => {
    const parsed = toNumber(val);
    validateValue(isFinite(parsed), val, 'number');
    return parsed;
  });
}

function buildTime(options: flags.DateTime): flags.Discriminated<flags.Discriminant> {
  return option('time', options, (val: string) => {
    const dateVal = new Date(`2000-01-02 ${val}`);
    validateValue(!isNaN(Date.parse(dateVal.toDateString())), val, 'time');
    return dateVal;
  });
}

function buildUrl(options: flags.Url): flags.Discriminated<flags.Url> {
  return option('url', options, (val: string) => {
    try {
      return new URL(val);
    } catch (err) {
      const correct = ` ${messages.getMessage('FormattingMessageUrl')}`;
      throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [val, 'url', correct || '']);
    }
  });
}

function buildBuiltin(options: flags.Builtin = { type: 'builtin' }): flags.Builtin {
  if (options.type !== 'builtin') {
    throw new SfdxError(`Invalid builtin flag type '${options.type}'`, 'InvalidBuiltinFlagTypeError');
  }
  // simply echo back the options for later processing in buildSfdxFlags
  return options;
}

export const flags = {
  // oclif

  /**
   * TODO
   */
  boolean: buildBoolean,

  /**
   * TODO
   */
  enum: buildEnum,

  /**
   * TODO
   */
  help: buildHelp,

  /**
   * TODO
   */
  integer: buildInteger,

  /**
   * TODO
   */
  option: buildOption,

  /**
   * TODO
   */
  string: buildString,

  /**
   * TODO
   */
  version: buildVersion,

  // sfdx

  /**
   * A delimited list of strings with the delimiter defaulting to `,`, e.g., "one,two,three".
   */
  array: buildArray,

  /**
   * A valid date, e.g., "01-02-2000" or "01/02/2000 01:02:34".
   */
  date: buildDate,

  /**
   * A valid datetime, e.g., "01-02-2000" or "01/02/2000 01:02:34".
   */
  datetime: buildDatetime,

  /**
   * **See** [@salesforce/core#sfdc.validatePathDoesNotContainInvalidChars](https://forcedotcom.github.io/sfdx-core/globals.html#validatepathdoesnotcontaininvalidchars), e.g. "this/is/my/path".
   */
  directory: buildDirectory,

  /**
   * **See** [@salesforce/core#sfdc.validateEmail](https://forcedotcom.github.io/sfdx-core/globals.html#validateemail), e.g., "me@my.org".
   */
  email: buildEmail,

  /**
   * **See** [@salesforce/core#sfdc.validatePathDoesNotContainInvalidChars](https://forcedotcom.github.io/sfdx-core/globals.html#validatepathdoesnotcontaininvalidchars), e.g. "this/is/my/path".
   */
  filepath: buildFilepath,

  /**
   * **See** [@salesforce/core#sfdc.validateSalesforceId](https://forcedotcom.github.io/sfdx-core/globals.html#validatesalesforceid), e.g., "00Dxxxxxxxxxxxx".
   */
  id: buildId,

  /**
   * An integer or floating point number, e.g., "42".
   */
  number: buildNumber,

  /**
   * A valid time, e.g., "01:02:03".
   */
  time: buildTime,

  /**
   * A valid url, e.g., "http://www.salesforce.com".
   */
  url: buildUrl,

  // builtins

  /**
   * Declares a flag definition to be one of the builtin types, for automatic configuration.
   */
  builtin: buildBuiltin
};

const requiredBuiltinFlags = {
  json(): flags.Discriminated<flags.Boolean<boolean>> {
    return flags.boolean({
      description: messages.getMessage('jsonFlagDescription'),
      longDescription: messages.getMessage('jsonFlagLongDescription')
    });
  },

  loglevel(): flags.Discriminated<flags.Enum<string>> {
    return flags.enum({
      options: Logger.LEVEL_NAMES,
      required: false,
      description: messages.getMessage('loglevelFlagDescription'),
      longDescription: messages.getMessage('loglevelFlagLongDescription'),
      parse: (val: string) => {
        if (Logger.LEVEL_NAMES.includes(val)) return val;
        throw SfdxError.create('@salesforce/command', 'flags', 'InvalidLoggerLevelError', [val]);
      }
    });
  }
};

const optionalBuiltinFlags = {
  apiversion(): flags.Discriminated<flags.String> {
    const flag = flags.string({
      description: messages.getMessage('apiversionFlagDescription'),
      longDescription: messages.getMessage('apiversionFlagLongDescription'),
      parse: (val: string) => {
        if (sfdc.validateApiVersion(val)) return val;
        throw SfdxError.create('@salesforce/command', 'flags', 'InvalidApiVersionError', [val]);
      }
    });
    return flag;
  },

  concise(): flags.Discriminated<flags.Boolean<boolean>> {
    return flags.boolean({
      description: messages.getMessage('conciseFlagDescription'),
      longDescription: messages.getMessage('conciseFlagLongDescription')
    });
  },

  quiet(): flags.Discriminated<flags.Boolean<boolean>> {
    return flags.boolean({
      description: messages.getMessage('quietFlagDescription'),
      longDescription: messages.getMessage('quietFlagLongDescription')
    });
  },

  targetdevhubusername(): flags.Discriminated<flags.String> {
    return flags.string({
      char: 'v',
      description: messages.getMessage('targetdevhubusernameFlagDescription'),
      longDescription: messages.getMessage('targetdevhubusernameFlagLongDescription')
    });
  },

  targetusername(): flags.Discriminated<flags.String> {
    return flags.string({
      char: 'u',
      description: messages.getMessage('targetusernameFlagDescription'),
      longDescription: messages.getMessage('targetusernameFlagLongDescription')
    });
  },

  verbose(): flags.Discriminated<flags.Boolean<boolean>> {
    return flags.boolean({
      description: messages.getMessage('verboseFlagDescription'),
      longDescription: messages.getMessage('verboseFlagLongDescription')
    });
  }
};

export type FlagsConfig = {
  [key: string]: Optional<flags.Boolean<unknown> | flags.Option<unknown> | flags.Builtin>;

  /**
   * TODO
   */
  apiversion?: flags.Builtin;

  /**
   * TODO
   */
  concise?: flags.Builtin;

  /**
   * TODO
   */
  quiet?: flags.Builtin;

  /**
   * TODO
   */
  targetdevhubusername?: flags.Builtin;

  /**
   * TODO
   */
  targetusername?: flags.Builtin;

  /**
   * TODO
   */
  verbose?: flags.Builtin;
};

function validateValue(isValid: boolean, value: string, kind: string, correct?: string) {
  if (isValid) return value;
  throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [value, kind, correct || '']);
}

/**
 * Validate the custom flag configuration. This includes:
 *
 * 1. The flag name is in all lowercase.
 * 2. A string description is provided.
 * 3. If a char attribute is provided, it is one alphabetical character in length.
 * 4. If a long description is provided, it is a string.
 *
 * @param {SfdxFlagDefinition} flag The flag configuration.
 * @param {string} key The flag name.
 * @throws SfdxError If the criteria is not meet.
 */
function validateCustomFlag<T>(key: string, flag: flags.Any<T>): flags.Any<T> {
  if (!/^(?!(?:[-]|[0-9]*$))[a-z0-9-]+$/.test(key)) {
    throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagName', [key]);
  }
  if (flag.char && (flag.char.length !== 1 || !/[a-zA-Z]/.test(flag.char))) {
    throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagChar', [key]);
  }
  if (!flag.description || !isString(flag.description)) {
    throw SfdxError.create('@salesforce/command', 'flags', 'MissingOrInvalidFlagDescription', [key]);
  }
  if (flag.longDescription !== undefined && !isString(flag.longDescription)) {
    throw SfdxError.create('@salesforce/command', 'flags', 'InvalidLongDescriptionFormat', [key]);
  }
  return flag;
}

/**
 * Builds flags for a command given a configuration object.  Supports the following use cases:
 *     1. Enabling common SFDX flags. E.g., { verbose: true }
 *     4. Defining typed flags. E.g., { myFlag: Flags.array({ char: '-a' }) }
 *     4. Defining custom typed flags. E.g., { myFlag: Flags.custom({ parse: (val) => parseInt(val, 10) }) }
 *
 * @param {FlagsConfig} flagsConfig The configuration object for a flag.  @see {@link FlagsConfig}
 * @returns {flags.Output} The flags for the command.
 * @ignore
 */
export function buildSfdxFlags(flagsConfig: FlagsConfig): flags.Output {
  const output: flags.Output = {};

  // Required flag options for all SFDX commands
  output.json = requiredBuiltinFlags.json();
  output.loglevel = requiredBuiltinFlags.loglevel();

  // Process configuration for custom and builtin flags
  definiteEntriesOf(flagsConfig).forEach(([key, flag]) => {
    if (isBuiltin(flag)) {
      if (isKeyOf(optionalBuiltinFlags, key)) {
        output[key] = optionalBuiltinFlags[key]();
        return;
      }
      throw SfdxError.create('@salesforce/command', 'flags', 'UnknownBuiltinFlagType', [key]);
    } else {
      output[key] = validateCustomFlag(key, flag);
    }
  });

  return output;
}

function isBuiltin(flag: object): flag is flags.Builtin {
  return hasString(flag, 'type') && flag.type === 'builtin';
}
