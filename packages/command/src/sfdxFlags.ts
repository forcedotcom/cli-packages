/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URL } from 'url';
import { flags as OclifFlags } from '@oclif/command';
import * as Parser from '@oclif/parser';
import { EnumFlagOptions, IBooleanFlag, IFlag, IOptionFlag } from '@oclif/parser/lib/flags';
import { Logger, LoggerLevel, Messages, sfdc, SfdxError } from '@salesforce/core';
import { Duration, toNumber } from '@salesforce/kit';
import {
  definiteEntriesOf,
  ensure,
  has,
  hasFunction,
  hasString,
  isFunction,
  isInstance,
  isKeyOf,
  isNumber,
  isString,
  Omit,
  Optional,
} from '@salesforce/ts-types';
import { Dictionary } from '@salesforce/ts-types';
import { Deprecation } from './ux';

Messages.importMessagesDirectory(__dirname);
const messages: Messages = Messages.loadMessages('@salesforce/command', 'flags');

function validateValue(isValid: boolean, value: string, kind: string, correct?: string): string {
  if (isValid) return value;
  throw SfdxError.create('@salesforce/command', 'flags', 'InvalidFlagTypeError', [value, kind, correct || '']);
}

function toValidatorFn(validator?: unknown): (val: string) => boolean {
  return (val: string): boolean => {
    if (isString(validator)) return new RegExp(validator).test(val);
    if (isInstance(validator, RegExp)) return validator.test(val);
    if (isFunction(validator)) return !!validator(val);
    return true;
  };
}

function merge<T>(
  kind: flags.Kind,
  flag: IOptionFlag<T | undefined>,
  describable: flags.Describable
): flags.Discriminated<flags.Option<T>>;
function merge<T>(
  kind: flags.Kind,
  flag: IBooleanFlag<T>,
  describable: flags.Describable
): flags.Discriminated<flags.Boolean<T>>;
function merge<T>(kind: flags.Kind, flag: IFlag<T>, describable: flags.Describable): flags.Discriminated<flags.Any<T>> {
  if (has(flag, 'validate') && hasFunction(flag, 'parse')) {
    const parse = flag.parse.bind(flag);
    flag.parse = <T>(val: string, ctx: unknown): T => {
      validateValue(toValidatorFn(flag.validate)(val), val, kind);
      return parse(val, ctx) as T;
    };
  }

  return {
    kind,
    ...flag,
    description: describable.description,
    longDescription: describable.longDescription,
  };
}

function option<T>(
  kind: flags.Kind,
  options: flags.Option<T>,
  parse: (val: string, ctx: unknown) => T
): flags.Discriminated<flags.Option<T>> {
  const flag = OclifFlags.option({ ...options, parse });
  const merged = merge<T>(kind, flag, options);
  return merged;
}

export namespace flags {
  export type Any<T> = Partial<OclifFlags.IFlag<T>> & SfdxProperties;
  export type Array<T = string> = Option<T[]> & { delimiter?: string };
  export type BaseBoolean<T> = Partial<IBooleanFlag<T>>;
  export type Boolean<T> = BaseBoolean<T> & SfdxProperties;
  export type Bounds<T> = { min?: T; max?: T };
  export type Builtin = { type: 'builtin' } & Partial<SfdxProperties>;
  export type DateTime = Option<Date>;
  export type Deprecatable = { deprecated?: Deprecation };
  export type Describable = { description: string; longDescription?: string };
  export type Discriminant = { kind: Kind };
  export type Discriminated<T> = T & Discriminant;
  export type Enum<T> = EnumFlagOptions<T> & SfdxProperties;
  export type Kind = keyof typeof flags;
  export type Input<T extends Parser.flags.Output> = OclifFlags.Input<T>;
  export type MappedArray<T> = Omit<flags.Array<T>, 'options'> & { map: (val: string) => T; options?: T[] };
  // allow numeric bounds for back compat
  export type Milliseconds = Option<Duration> & Bounds<Duration | number>;
  // allow numeric bounds for back compat
  export type Minutes = Option<Duration> & Bounds<Duration | number>;
  export type Number = Option<number> & NumericBounds;
  export type NumericBounds = Bounds<number>;
  export type Option<T> = Partial<IOptionFlag<T>> & SfdxProperties & Validatable;
  export type Output = OclifFlags.Output;
  // allow numeric bounds for back compat
  export type Seconds = Option<Duration> & Bounds<Duration | number>;
  export type SfdxProperties = Describable & Deprecatable;
  export type String = Option<string>;
  export type Url = Option<URL>;
  export type Validatable = { validate?: string | RegExp | ((val: string) => boolean) };
}

// oclif

function buildBoolean<T = boolean>(options: flags.Boolean<T>): flags.Discriminated<flags.Boolean<T>> {
  const flag = OclifFlags.boolean(options);
  return merge<T>('boolean', flag, options);
}

function buildEnum<T>(options: flags.Enum<T>): flags.Discriminated<flags.Enum<T>> {
  return {
    kind: 'enum',
    ...OclifFlags.enum(options),
    options: options.options,
    description: options.description,
    longDescription: options.longDescription,
  };
}

function buildHelp(options: flags.BaseBoolean<boolean>): flags.Discriminated<flags.Boolean<void>> {
  const flag = OclifFlags.help(options);
  return merge('help', OclifFlags.help(options), {
    description: ensure(flag.description),
  });
}

function validateBounds<T>(
  kind: flags.Kind,
  value: number,
  bounds: flags.Bounds<T>,
  extract: (t: T) => number
): number {
  if (bounds.min != null && value < extract(bounds.min)) {
    throw new SfdxError(
      `Expected ${kind} greater than or equal to ${extract(bounds.min)} but received ${value}`,
      'InvalidFlagNumericBoundsError'
    );
  }
  if (bounds.max != null && value > extract(bounds.max)) {
    throw new SfdxError(
      `Expected ${kind} less than or equal to ${extract(bounds.max)} but received ${value}`,
      'InvalidFlagNumericBoundsError'
    );
  }
  return value;
}

function buildInteger(options: flags.Number): flags.Discriminated<flags.Number> {
  const kind = 'integer';
  return option(kind, options, (val: string) => {
    const parsed = toNumber(val);
    validateValue(Number.isInteger(parsed), val, kind);
    return validateBounds(kind, parsed, options, (t: number) => t);
  });
}

function buildOption<T>(
  options: { parse: (val: string, ctx: unknown) => T } & flags.Option<T>
): flags.Discriminated<flags.Option<T>> {
  return merge('option', OclifFlags.option(options), options);
}

function buildString(options: flags.String): flags.Discriminated<flags.String> {
  return merge<string>('string', OclifFlags.string(options), options);
}

function buildVersion(options?: flags.BaseBoolean<boolean>): flags.Discriminated<flags.Boolean<void>> {
  const flag = OclifFlags.version(options);
  return merge('version', flag, {
    description: ensure(flag.description),
  });
}

// sfdx

function validateArrayValues(
  kind: flags.Kind,
  raw: string,
  vals: string[],
  validator?: string | RegExp | ((val: string) => boolean)
): void {
  validateValue(
    vals.every(toValidatorFn(validator)),
    raw,
    kind,
    ` ${messages.getMessage('FormattingMessageArrayValue')}`
  );
}

function validateArrayOptions<T>(kind: flags.Kind, raw: string, vals: T[], allowed: Set<T>): void {
  validateValue(
    allowed.size === 0 || vals.every((t) => allowed.has(t)),
    raw,
    kind,
    ` ${messages.getMessage('FormattingMessageArrayOption', [Array.from(allowed).toString()])}`
  );
}

const convertArrayFlagToArray = (flagValue: string, delimiter = ','): string[] => {
  // don't split on delimiter if it's inside a single or double-quoted substring
  // eslint-disable-next-line no-useless-escape
  const regex = new RegExp(`\"(.*?)\"|\'(.*?)\'|${delimiter}`);
  return flagValue
    .split(regex)
    .filter((i) => !!i)
    .map((i) => i.trim());
};

function buildMappedArray<T>(kind: flags.Kind, options: flags.MappedArray<T>): flags.Discriminated<flags.Array<T>> {
  const { options: values, ...rest } = options;
  const allowed = new Set(values);
  return option(kind, rest, (val: string): T[] => {
    const vals = convertArrayFlagToArray(val, options.delimiter);
    validateArrayValues(kind, val, vals, options.validate);
    const mappedVals = vals.map(options.map);
    validateArrayOptions(kind, val, mappedVals, allowed);
    return mappedVals;
  });
}

function buildStringArray(kind: flags.Kind, options: flags.Array<string>): flags.Discriminated<flags.Array<string>> {
  const { options: values, ...rest } = options;
  const allowed = new Set(values);
  return option(kind, rest, (val) => {
    const vals = convertArrayFlagToArray(val, options.delimiter);
    validateArrayValues(kind, val, vals, options.validate);
    validateArrayOptions(kind, val, vals, allowed);
    return vals;
  });
}

function buildArray(options: flags.Array<string>): flags.Discriminated<flags.Array<string>>;
function buildArray<T>(options: flags.MappedArray<T>): flags.Discriminated<flags.Array<T>>;
function buildArray<T>(
  options: flags.Array | flags.MappedArray<T>
): flags.Discriminated<flags.Array<string>> | flags.Discriminated<flags.Array<T>> {
  const kind = 'array';
  return 'map' in options ? buildMappedArray(kind, options) : buildStringArray(kind, options);
}

function buildDate(options: flags.DateTime): flags.Discriminated<flags.DateTime> {
  const kind = 'date';
  return option(kind, options, (val: string) => {
    const parsed = Date.parse(val);
    validateValue(!isNaN(parsed), val, kind, ` ${messages.getMessage('FormattingMessageDate')}`);
    return new Date(parsed);
  });
}

function buildDatetime(options: flags.DateTime): flags.Discriminated<flags.DateTime> {
  const kind = 'datetime';
  return option(kind, options, (val: string) => {
    const parsed = Date.parse(val);
    validateValue(!isNaN(parsed), val, kind, ` ${messages.getMessage('FormattingMessageDate')}`);
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

function buildMilliseconds(options: flags.Milliseconds): flags.Discriminated<flags.Milliseconds> {
  const kind = 'milliseconds';
  return option(kind, options, (val: string) => {
    const parsed = toNumber(val);
    validateValue(Number.isInteger(parsed), val, kind);
    return Duration.milliseconds(validateBounds(kind, parsed, options, (v) => (isNumber(v) ? v : v[kind])));
  });
}

function buildMinutes(options: flags.Minutes): flags.Discriminated<flags.Minutes> {
  const kind = 'minutes';
  return option(kind, options, (val: string) => {
    const parsed = toNumber(val);
    validateValue(Number.isInteger(parsed), val, kind);
    return Duration.minutes(validateBounds(kind, parsed, options, (v) => (isNumber(v) ? v : v[kind])));
  });
}

function buildNumber(options: flags.Number): flags.Discriminated<flags.Number> {
  const kind = 'number';
  return option(kind, options, (val: string) => {
    const parsed = toNumber(val);
    validateValue(isFinite(parsed), val, kind);
    return validateBounds(kind, parsed, options, (t: number) => t);
  });
}

function buildSeconds(options: flags.Seconds): flags.Discriminated<flags.Seconds> {
  const kind = 'seconds';
  return option(kind, options, (val: string) => {
    const parsed = toNumber(val);
    validateValue(Number.isInteger(parsed), val, kind);
    return Duration.seconds(validateBounds(kind, parsed, options, (v) => (isNumber(v) ? v : v[kind])));
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

function buildBuiltin(options: Partial<flags.Builtin> = {}): flags.Builtin {
  return { ...options, type: 'builtin' };
}

export const flags = {
  // oclif

  /**
   * A flag type whose presence indicates a `true` boolean value. Produces false when not present.
   */
  boolean: buildBoolean,

  /**
   * A flag type with a fixed enumeration of possible option values. Produces a validated string from the `options` list.
   */
  enum: buildEnum,

  /**
   * A flag type useful for overriding the short `char` trigger for emitting CLI help. Emits help and exits the CLI.
   */
  help: buildHelp,

  /**
   * A flag type that accepts basic integer values. For floats, binary, octal, and hex, see {@link flags.number}.
   * Produces an integer `number`.
   */
  integer: buildInteger,

  /**
   * A flag type for custom string processing. Accepts a `parse` function that converts a `string` value to a type `T`.
   * Produces a type `T`.
   */
  option: buildOption,

  /**
   * A flag type for returning a raw `string` value without further preprocessing. Produces a string.
   */
  string: buildString,

  /**
   * A flag type for emitting CLI version information. Emits the CLI version and exits the CLI.
   */
  version: buildVersion,

  // sfdx

  /**
   * A flag type for a delimited list of strings with the delimiter defaulting to `,`, e.g., "one,two,three". Accepts
   * an optional `delimiter` `string` and/or a custom `map` function for converting parsed `string` values into
   * a type `T`. Produces a parsed (and possibly mapped) array of type `T` where `T` defaults to `string` if no
   * custom `map` function was provided.
   */
  array: buildArray,

  /**
   * A flag type for a valid date, e.g., "01-02-2000" or "01/02/2000 01:02:34". Produces a parsed `Date`.
   */
  date: buildDate,

  /**
   * A flag type for a valid datetime, e.g., "01-02-2000" or "01/02/2000 01:02:34". Produces a parsed `Date`.
   */
  datetime: buildDatetime,

  /**
   * A flag type for valid directory paths. Produces a validated string.
   *
   * **See** [@salesforce/core#sfdc.validatePathDoesNotContainInvalidChars](https://forcedotcom.github.io/sfdx-core/globals.html#sfdc), e.g. "this/is/my/path".
   */
  directory: buildDirectory,

  /**
   * A flag type for valid email addresses. Produces a validated string.
   *
   * **See** [@salesforce/core#sfdc.validateEmail](https://forcedotcom.github.io/sfdx-core/globals.html#sfdc), e.g., "me@my.org".
   */
  email: buildEmail,

  /**
   * A flag type for valid file paths. Produces a validated string.
   *
   * **See** [@salesforce/core#sfdc.validatePathDoesNotContainInvalidChars](https://forcedotcom.github.io/sfdx-core/globals.html#sfdc), e.g. "this/is/my/path".
   */
  filepath: buildFilepath,

  /**
   * A flag type for valid Salesforce IDs. Produces a validated string.
   *
   * **See** [@salesforce/core#sfdc.validateSalesforceId](https://forcedotcom.github.io/sfdx-core/globals.html#sfdc), e.g., "00Dxxxxxxxxxxxx".
   */
  id: buildId,

  /**
   * A flag type for a valid `Duration` in milliseconds, e.g., "5000".
   */
  milliseconds: buildMilliseconds,

  /**
   * A flag type for a valid `Duration` in minutes, e.g., "2".
   */
  minutes: buildMinutes,

  /**
   * A flag type for valid integer or floating point number, e.g., "42". Additionally supports binary, octal, and hex
   * notation. Produces a parsed `number`.
   */
  number: buildNumber,

  /**
   * A flag type for a valid `Duration` in seconds, e.g., "5".
   */
  seconds: buildSeconds,

  /**
   * A flag type for a valid url, e.g., "http://www.salesforce.com". Produces a parsed `URL` instance.
   */
  url: buildUrl,

  // builtins

  /**
   * Declares a flag definition to be one of the builtin types, for automatic configuration.
   */
  builtin: buildBuiltin,
};

export const requiredBuiltinFlags = {
  json(): flags.Discriminated<flags.Boolean<boolean>> {
    return flags.boolean({
      description: messages.getMessage('jsonFlagDescription'),
      longDescription: messages.getMessage('jsonFlagLongDescription'),
    });
  },

  loglevel(): flags.Discriminated<flags.Enum<string>> {
    return flags.enum({
      options: Logger.LEVEL_NAMES.concat(Logger.LEVEL_NAMES.map((l) => l.toUpperCase())),
      default: LoggerLevel[Logger.DEFAULT_LEVEL].toLowerCase(),
      required: false,
      description: messages.getMessage('loglevelFlagDescription'),
      longDescription: messages.getMessage('loglevelFlagLongDescription'),
      parse: (val: string) => {
        val = val.toLowerCase();
        if (Logger.LEVEL_NAMES.includes(val)) return val;
        throw SfdxError.create('@salesforce/command', 'flags', 'InvalidLoggerLevelError', [val]);
      },
    });
  },
};

function resolve(opts: Optional<flags.Builtin>, key: keyof flags.Builtin, def: string): string {
  return hasString(opts, key) ? opts[key] : def;
}

export const optionalBuiltinFlags = {
  apiversion(opts?: flags.Builtin): flags.Discriminated<flags.String> {
    return Object.assign(
      opts || {},
      flags.string({
        description: resolve(opts, 'description', messages.getMessage('apiversionFlagDescription')),
        longDescription: resolve(opts, 'longDescription', messages.getMessage('apiversionFlagLongDescription')),
        parse: (val: string) => {
          if (sfdc.validateApiVersion(val)) return val;
          throw SfdxError.create('@salesforce/command', 'flags', 'InvalidApiVersionError', [val]);
        },
      })
    );
  },

  concise(opts?: flags.Builtin): flags.Discriminated<flags.Boolean<boolean>> {
    return Object.assign(
      opts || {},
      flags.boolean({
        description: resolve(opts, 'description', messages.getMessage('conciseFlagDescription')),
        longDescription: resolve(opts, 'longDescription', messages.getMessage('conciseFlagLongDescription')),
      })
    );
  },

  quiet(opts?: flags.Builtin): flags.Discriminated<flags.Boolean<boolean>> {
    return Object.assign(
      opts || {},
      flags.boolean({
        description: resolve(opts, 'description', messages.getMessage('quietFlagDescription')),
        longDescription: resolve(opts, 'longDescription', messages.getMessage('quietFlagLongDescription')),
      })
    );
  },

  targetdevhubusername(opts?: flags.Builtin): flags.Discriminated<flags.String> {
    return Object.assign(
      opts || {},
      flags.string({
        char: 'v',
        description: resolve(opts, 'description', messages.getMessage('targetdevhubusernameFlagDescription')),
        longDescription: resolve(
          opts,
          'longDescription',
          messages.getMessage('targetdevhubusernameFlagLongDescription')
        ),
      })
    );
  },

  targetusername(opts?: flags.Builtin): flags.Discriminated<flags.String> {
    return Object.assign(
      opts || {},
      flags.string({
        char: 'u',
        description: resolve(opts, 'description', messages.getMessage('targetusernameFlagDescription')),
        longDescription: resolve(opts, 'longDescription', messages.getMessage('targetusernameFlagLongDescription')),
      })
    );
  },

  verbose(opts?: flags.Builtin): flags.Discriminated<flags.Boolean<boolean>> {
    return Object.assign(
      opts || {},
      flags.boolean({
        description: resolve(opts, 'description', messages.getMessage('verboseFlagDescription')),
        longDescription: resolve(opts, 'longDescription', messages.getMessage('verboseFlagLongDescription')),
      })
    );
  },
};

/**
 * The configuration of flags for an {@link SfdxCommand} class, except for the following:
 *
 * * `json` and `loglevel` are configured automatically for all {@link SfdxCommand} classes.
 * * `targetusername` is enabled using either `SfdxCommand.supportsUsername` or `SfdxCommand.requiresUsername`.
 * * `targetdevhubusername` is enabled using either `SfdxCommand.supportsDevhubUsername` or `SfdxCommand.requiresDevhubUsername`.
 *
 * Additionally, `apiversion` is enabled automatically if any of the static `*Username` booleans are set, but may be
 * configured here explicitly as well if those settings are not required.
 *
 * ```
 * public static flagsConfig: FlagsConfig = {
 *   name: flags.string({ char: 'n', required: true, description: 'name of the resource to create' }),
 *   source: flags.directory({ char: 'd', required: true, description: 'path of the source directory to sync' }),
 *   wait: flags.minutes({ description: 'number of minutes to wait for creation' }),
 *   notify: flags.url({ description: 'url to notify upon completion' })
 * };
 * ```
 */
export type FlagsConfig = {
  [key: string]: Optional<flags.Boolean<unknown> | flags.Option<unknown> | flags.Builtin>;

  /**
   * Adds the `apiversion` built-in flag to allow for overriding the API
   * version when executing the command.
   */
  apiversion?: flags.Builtin;

  /**
   * Adds the `concise` built-in flag to allow a command to support concise output,
   * which is useful when the output can be overly verbose, such as test results.
   * Note that this must be implemented by the command.
   */
  concise?: flags.Builtin;

  /**
   * Adds the `quiet` built-in flag to allow a command to completely suppress output.
   * Note that this must be implemented by the command.
   */
  quiet?: flags.Builtin;

  /**
   * Adds the `verbose` built-in flag to allow a command to support verbose output,
   * which is useful to display additional command results.
   * Note that this must be implemented by the command.
   */
  verbose?: flags.Builtin;

  // not supported on flagsConfig in any form -- use related static boolean properties instead
  targetdevhubusername?: never;
  targetusername?: never;
};

/**
 * Validate the custom flag configuration. This includes:
 *
 * - The flag name is in all lowercase.
 * - A string description is provided.
 * - If a char attribute is provided, it is one alphabetical character in length.
 * - If a long description is provided, it is a string.
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

function isBuiltin(flag: object): flag is flags.Builtin {
  return hasString(flag, 'type') && flag.type === 'builtin';
}

/**
 * Builds flags for a command given a configuration object.  Supports the following use cases:
 * 1. Enabling common SFDX flags. E.g., { verbose: true }
 * 2. Defining typed flags. E.g., { myFlag: Flags.array({ char: '-a' }) }
 * 3. Defining custom typed flags. E.g., { myFlag: Flags.custom({ parse: (val) => parseInt(val, 10) }) }
 *
 * @param {FlagsConfig} flagsConfig The configuration object for a flag.  @see {@link FlagsConfig}
 * @param options Extra configuration options.
 * @returns {flags.Output} The flags for the command.
 * @ignore
 */
export function buildSfdxFlags(
  flagsConfig: FlagsConfig,
  options: { targetdevhubusername?: boolean; targetusername?: boolean }
  // tslint:disable-next-line:no-any matches oclif
): flags.Output {
  const output: Dictionary<flags.Any<unknown>> = {};

  // Required flag options for all SFDX commands
  output.json = requiredBuiltinFlags.json();
  output.loglevel = requiredBuiltinFlags.loglevel();

  if (options.targetdevhubusername) output.targetdevhubusername = optionalBuiltinFlags.targetdevhubusername();
  if (options.targetusername) output.targetusername = optionalBuiltinFlags.targetusername();
  if (options.targetdevhubusername || options.targetusername) output.apiversion = optionalBuiltinFlags.apiversion();

  // Process configuration for custom and builtin flags
  definiteEntriesOf(flagsConfig).forEach(([key, flag]) => {
    if (isBuiltin(flag)) {
      if (!isKeyOf(optionalBuiltinFlags, key)) {
        throw SfdxError.create('@salesforce/command', 'flags', 'UnknownBuiltinFlagType', [key]);
      }
      output[key] = optionalBuiltinFlags[key](flag);
    } else {
      output[key] = validateCustomFlag<unknown>(key, flag);
    }
  });

  return output;
}
