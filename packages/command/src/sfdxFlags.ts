/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags as Flags } from '@oclif/command';
import { EnumFlagOptions, IBooleanFlag, IFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { Logger, Messages, sfdc, SfdxError } from '@salesforce/core';
import { toNumber } from '@salesforce/kit';
import { definiteEntriesOf, hasString, isKeyOf, isString, Optional } from '@salesforce/ts-types';
import { URL } from 'url';

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('@salesforce/command', 'flags');

export namespace flags {
  export type Array = Option<string[]> & { delimiter?: string };
  export type Base<T> = Partial<IFlag<T>> & Describable;
  export type Boolean = Partial<IBooleanFlag<boolean>> & flags.Base<boolean>;
  export type Builtin = {};
  export type Describable = { description: string; longDescription?: string };
  export type DateTime = Option<Date>;
  export type Enum = Partial<EnumFlagOptions<Optional<string>>> & Describable;
  export type Number = Option<number>;
  export type Option<T> = Partial<IOptionFlag<Optional<T>>> & flags.Base<Optional<T>>;
  export type String = Option<string>;
  export type Url = Option<URL>;
}

const requiredBuiltinFlags = {
  json(): flags.Boolean {
    return {
      ...Flags.boolean(),
      description: messages.getMessage('jsonFlagDescription'),
      longDescription: messages.getMessage('jsonFlagLongDescription')
    };
  },

  loglevel(): flags.String {
    return build(
      {
        options: Logger.LEVEL_NAMES,
        required: false,
        description: messages.getMessage('loglevelFlagDescription'),
        longDescription: messages.getMessage('loglevelFlagLongDescription')
      },
      (val: string) => {
        if (Logger.LEVEL_NAMES.includes(val)) return val;
        throw SfdxError.create('@salesforce/command', 'flags', 'InvalidLoggerLevelError', [val]);
      }
    );
  }
};

const builtinFlags = {
  apiversion(): flags.String {
    return build(
      {
        description: messages.getMessage('apiversionFlagDescription'),
        longDescription: messages.getMessage('apiversionFlagLongDescription')
      },
      (val: string) => {
        if (sfdc.validateApiVersion(val)) return val;
        throw SfdxError.create('@salesforce/command', 'flags', 'InvalidApiVersionError', [val]);
      }
    );
  },

  concise(): flags.Boolean {
    return merge(Flags.boolean(), {
      description: messages.getMessage('conciseFlagDescription'),
      longDescription: messages.getMessage('conciseFlagLongDescription')
    });
  },

  quiet(): flags.Boolean {
    return merge(Flags.boolean(), {
      description: messages.getMessage('quietFlagDescription'),
      longDescription: messages.getMessage('quietFlagLongDescription')
    });
  },

  targetdevhubusername(): flags.String {
    return merge(Flags.build({ char: 'v' })(), {
      description: messages.getMessage('targetdevhubusernameFlagDescription'),
      longDescription: messages.getMessage('targetdevhubusernameFlagLongDescription')
    });
  },

  targetusername(): flags.String {
    return merge(Flags.build({ char: 'u' })(), {
      description: messages.getMessage('targetusernameFlagDescription'),
      longDescription: messages.getMessage('targetusernameFlagLongDescription')
    });
  },

  verbose(): flags.Boolean {
    return merge(Flags.boolean(), {
      description: messages.getMessage('verboseFlagDescription'),
      longDescription: messages.getMessage('verboseFlagLongDescription')
    });
  }
};

function validateValue(isValid: boolean, value: string, flagType: string, correct?: string) {
  if (isValid) return value;
  throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [value, flagType, correct || '']);
}

export type FlagsConfig = {
  [key: string]: Optional<flags.Base<unknown> | flags.Builtin>;

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

function merge<T>(flag: IFlag<T>, describable: flags.Describable): flags.Base<T> {
  return {
    ...flag,
    description: describable.description,
    longDescription: describable.longDescription
  };
}

function build<T>(options: flags.Option<T>, parse: (val: string) => T): flags.Option<T> {
  return merge(Flags.build(Object.assign(options, { parse }))(), options);
}

export const flags = {
  // oclif

  boolean(options: flags.Boolean): flags.Boolean {
    return merge(Flags.boolean(options), options);
  },

  // TODO: work out the typings for this beast
  // enum(options: flags.Enum): flags.Enum {
  //   return merge(Flags.enum(options), options);
  // },

  // TODO: does it make sense to require description and longDescription here?  make sure we test this out...
  help(options: flags.Boolean): flags.Boolean {
    return merge(Flags.help(options), options);
  },

  integer(options: flags.Number): flags.Number {
    return merge(Flags.integer(options), options);
  },

  option<T>(options: { parse: (val: string, context: unknown) => T } & flags.Option<T>): flags.Option<T> {
    return merge(Flags.option(options), options);
  },

  string(options: flags.String): flags.String {
    return merge(Flags.string(options), options);
  },

  // sfdx

  /**
   * A delimited list of strings with the delimiter defaulting to `,`, e.g., "one,two,three".
   */
  array(options: flags.Array): flags.Array {
    return build(options, (val: string) => {
      return val.split(options.delimiter || ',');
    });
  },

  /**
   * A valid date, e.g., "01-02-2000" or "01/02/2000 01:02:34".
   */
  date(options: flags.DateTime): flags.DateTime {
    return build(options, (val: string) => {
      const parsed = Date.parse(val);
      validateValue(!isNaN(parsed), val, 'date', ` ${messages.getMessage('FormattingMessageDate')}`);
      return new Date(parsed);
    });
  },

  /**
   * A valid datetime, e.g., "01-02-2000" or "01/02/2000 01:02:34".
   */
  datetime(options: flags.DateTime): flags.DateTime {
    return build(options, (val: string) => {
      const parsed = Date.parse(val);
      validateValue(!isNaN(parsed), val, 'datetime', ` ${messages.getMessage('FormattingMessageDate')}`);
      return new Date(parsed);
    });
  },

  /**
   * **See** [@salesforce/core#sfdc.validatePathDoesNotContainInvalidChars](https://forcedotcom.github.io/sfdx-core/globals.html#validatepathdoesnotcontaininvalidchars), e.g. "this/is/my/path".
   */
  directory(options: flags.String): flags.String {
    return build(options, (val: string) => {
      return validateValue(sfdc.validatePathDoesNotContainInvalidChars(val), val, 'directory');
    });
  },

  /**
   * **See** [@salesforce/core#sfdc.validateEmail](https://forcedotcom.github.io/sfdx-core/globals.html#validateemail), e.g., "me@my.org".
   */
  email(options: flags.String): flags.String {
    return build(options, (val: string) => {
      return validateValue(sfdc.validateEmail(val), val, 'email');
    });
  },

  /**
   * **See** [@salesforce/core#sfdc.validatePathDoesNotContainInvalidChars](https://forcedotcom.github.io/sfdx-core/globals.html#validatepathdoesnotcontaininvalidchars), e.g. "this/is/my/path".
   */
  filepath(options: flags.String): flags.String {
    return build(options, (val: string) => {
      return validateValue(sfdc.validatePathDoesNotContainInvalidChars(val), val, 'filepath');
    });
  },

  /**
   * **See** [@salesforce/core#sfdc.validateSalesforceId](https://forcedotcom.github.io/sfdx-core/globals.html#validatesalesforceid), e.g., "00Dxxxxxxxxxxxx".
   */
  id(options: flags.String): flags.String {
    return build(options, (val: string) => {
      return validateValue(sfdc.validateSalesforceId(val), val, 'id', ` ${messages.getMessage('FormattingMessageId')}`);
    });
  },

  /**
   * An integer or floating point number, e.g., "42".
   */
  number(options: flags.Number): flags.Number {
    return build(options, (val: string) => {
      const parsed = toNumber(val);
      validateValue(isFinite(parsed), val, 'number');
      return parsed;
    });
  },

  /**
   * A valid time, e.g., "01:02:03".
   */
  time(options: flags.DateTime): flags.DateTime {
    return build(options, (val: string) => {
      const dateVal = new Date(`2000-01-02 ${val}`);
      validateValue(!isNaN(Date.parse(dateVal.toDateString())), val, 'time');
      return dateVal;
    });
  },

  /**
   * A valid url, e.g., "http://www.salesforce.com".
   */
  url(options: flags.Url): flags.Url {
    return build(options, (val: string) => {
      try {
        return new URL(val);
      } catch (err) {
        throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [val, 'url', '']);
      }
    });
  },

  // builtins

  /**
   * TODO
   */
  builtin(options: flags.Builtin = {}): flags.Builtin {
    // type='builtin' is added here as an internal discriminator used by buildSfdxFlags
    return { ...options, type: 'builtin' };
  }
};

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
function validateCustomFlag<T>(key: string, flag: flags.Base<T>): flags.Base<T> {
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
 * @returns {Flags.Output} The flags for the command.
 */
export function buildSfdxFlags(flagsConfig: FlagsConfig): Flags.Output {
  const output: Flags.Output = {};

  // Required flag options for all SFDX commands
  output.json = requiredBuiltinFlags.json();
  output.loglevel = requiredBuiltinFlags.loglevel();

  // Process configuration for custom and builtin flags
  definiteEntriesOf(flagsConfig).forEach(([key, flag]) => {
    if (isBuiltin(flag)) {
      if (isKeyOf(builtinFlags, key)) {
        output[key] = builtinFlags[key];
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
