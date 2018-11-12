/*
 * Copyright (c) 2016, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * A table option configuration type that can be the TableOptions as defined by
 * [oclif/cli-ux](https://github.com/oclif/cli-ux/blob/master/src/styled/table.ts) or a string array of table keys to be used as table headers
 * for simple tables.
 * @typedef {object} SfdxTableOptions
 * @property {TableOptions | string[]} options
 */

/**
 * A prompt option configuration as defined by
 * [oclif/cli-ux](https://github.com/oclif/cli-ux/blob/master/src/prompt.ts).
 * @typedef {object} IPromptOptions
 * @property {string} prompt The prompt string displayed to the user.
 * @property {'normal' | 'mask' | 'hide'} type `Normal` does not hide the user input, `mask` hides the user input after the user presses `ENTER`, and `hide` hides the user input as it is being typed.
 */

import { Logger, LoggerLevel } from '@salesforce/core';
import { isArray, Optional } from '@salesforce/ts-types';
import chalk from 'chalk';
import { cli, IPromptOptions } from 'cli-ux';
import {
  TableColumn,
  TableOptions as OclifTableOptions
} from 'cli-ux/lib/styled/table';

/**
 * Utilities for interacting with terminal I/O.
 */
export class UX {
  /**
   * Collection of warnings that can be accessed and manipulated later.
   * @type {Set<string>}
   */
  public static warnings: Set<string> = new Set<string>();

  /**
   * Formats a deprecation warning for display to `stderr`, `stdout`, and/or logs.
   *
   * @param {DeprecationDefinition} def The definition for the deprecated object.
   * @returns {string} The formatted deprecation message.
   */
  public static formatDeprecationWarning(def: DeprecationDefinition): string {
    let msg =
      def.messageOverride ||
      `The ${def.type} "${
        def.name
      }" has been deprecated and will be removed in v${(def.version || 0) +
        1}.0 or later.`;
    if (def.to) {
      msg += ` Use "${def.to}" instead.`;
    }
    if (def.message) {
      msg += ` ${def.message}`;
    }
    return msg;
  }

  /**
   * Create a `UX` instance.
   *
   * @returns {Promise<UX>} A `Promise` of the created `UX` instance.
   */
  public static async create(): Promise<UX> {
    return new UX(await Logger.child('UX'));
  }

  public cli: typeof cli;

  /**
   * Do not directly construct instances of this class -- use {@link UX.create} instead.
   */
  constructor(
    private logger: Logger,
    private isOutputEnabled: boolean = true,
    ux?: typeof cli
  ) {
    this.cli = ux || cli;
  }

  /**
   * Logs at `INFO` level and conditionally writes to `stdout` if stream output is enabled.
   *
   * @param {...any[]} args The messages or objects to log.
   * @returns {UX}
   */
  public log(...args: string[]): UX {
    if (this.isOutputEnabled) {
      this.cli.log(...args);
    }

    // log to sfdx.log after the console as log filtering mutates the args.
    this.logger.info(...args);

    return this;
  }

  /**
   * Log JSON to stdout and to the log file with log level info.
   *
   * @param {object} obj The object to log -- must be serializable as JSON.
   * @returns {UX}
   * @throws {TypeError} If the object is not JSON-serializable.
   */
  public logJson(obj: object): UX {
    this.cli.styledJSON(obj);

    // log to sfdx.log after the console as log filtering mutates the args.
    this.logger.info(obj);

    return this;
  }

  /**
   * Prompt the user for input.
   * @param {string} name The string that the user sees when prompted for information.
   * @param {IPromptOptions} options A prompt option configuration.
   * @returns {Promise<string>} The user input to the prompt.
   */
  public async prompt(
    name: string,
    options: IPromptOptions = {}
  ): Promise<string> {
    return this.cli.prompt(name, options);
  }

  /**
   * Prompt the user for confirmation.
   * @param {string} message The message displayed to the user.
   * @returns {Promise<boolean>} Returns `true` if the user inputs 'y' or 'yes', and `false` if the user inputs 'n' or 'no'.
   */
  public async confirm(message: string): Promise<boolean> {
    return this.cli.confirm(message);
  }

  /**
   * Start a spinner action after displaying the given message.
   * @param {string} message The message displayed to the user.
   */
  public startSpinner(message: string): void {
    this.cli.action.start(message);
  }

  /**
   * Pause the spinner and call the given function.
   * @param {function} fn The function to be called in the pause.
   * @param {string} icon The string displayed to the user.
   * @returns {T} The result returned by the passed in function.
   */
  public pauseSpinner<T>(fn: () => T, icon?: string): T {
    return this.cli.action.pause(fn, icon);
  }

  /**
   * Update the spinner status.
   * @param {string} status The message displayed to the user.
   */
  public setSpinnerStatus(status?: string): void {
    this.cli.action.status = status;
  }

  /**
   * Get the spinner status.
   * @returns {Optional<string>}
   */
  public getSpinnerStatus(): Optional<string> {
    return this.cli.action.status;
  }

  /**
   * Stop the spinner action.
   * @param {string} message The message displayed to the user.
   */
  public stopSpinner(message?: string): void {
    this.cli.action.stop(message);
  }

  /**
   * Logs a warning as `WARN` level and conditionally writes to `stderr` if the log
   * level is `WARN` or above and stream output is enabled.  The message is added
   * to the static {@link UX.warnings} set if stream output is _not_ enabled, for later
   * consumption and manipulation.
   *
   * @param {string} message The warning message to output.
   * @returns {UX}
   * @see UX.warnings
   */
  public warn(message: string): UX {
    const warning: string = chalk.yellow('WARNING:');

    // Necessarily log to sfdx.log.
    this.logger.warn(warning, message);

    if (this.logger.shouldLog(LoggerLevel.WARN)) {
      if (!this.isOutputEnabled) {
        UX.warnings.add(message);
      } else {
        console.warn(`${warning} ${message}`);
      }
    }

    return this;
  }

  /**
   * Logs an error at `ERROR` level and conditionally writes to `stderr` if stream
   * output is enabled.
   *
   * @param {...any[]} args The errors to log.
   * @returns {UX}
   */
  public error(...args: Array<unknown>): UX {
    if (this.isOutputEnabled) {
      console.error(...args);
    }

    this.logger.error(...args);

    return this;
  }

  /**
   * Logs an object as JSON at `ERROR` level and to `stderr`.
   *
   * @param {object} obj The error object to log -- must be serializable as JSON.
   * @returns {UX}
   * @throws {TypeError} If the object is not JSON-serializable.
   */
  public errorJson(obj: object): UX {
    const err = JSON.stringify(obj, null, 4);
    console.error(err);
    this.logger.error(err);
    return this;
  }

  /**
   * Logs at `INFO` level and conditionally writes to `stdout` in a table format if
   * stream output is enabled.
   *
   * @param {object[]} rows The rows of data to be output in table format.
   * @param {SfdxTableOptions} options The {@link SfdxTableOptions} to use for formatting.
   * @returns {UX}
   */
  // tslint:disable-next-line no-any (matches oclif)
  public table(rows: any[], options: TableOptions = {}): UX {
    if (this.isOutputEnabled) {
      // This is either an array of column names or an already built Partial<OclifTableOptions>
      if (isArray(options)) {
        const tableColumns: Array<Partial<TableColumn>> = [];
        for (const col of options) {
          tableColumns.push({ key: col, label: col.toUpperCase() });
        }
        this.cli.table(rows, { columns: tableColumns });
      } else {
        this.cli.table(rows, options);
      }
    }

    // Log after table output as log filtering mutates data.
    this.logger.info(rows);

    return this;
  }

  /**
   * Logs at `INFO` level and conditionally writes to `stdout` in a styled object format if
   * stream output is enabled.
   *
   * @param {object} obj The object to be styled for stdout.
   * @param {string[]} [keys] The object keys to be written to stdout.
   * @returns {UX}
   */
  public styledObject(obj: object, keys?: string[]): UX {
    this.logger.info(obj);
    if (this.isOutputEnabled) {
      this.cli.styledObject(obj, keys);
    }
    return this;
  }

  /**
   * Log at `INFO` level and conditionally write to `stdout` in styled JSON format if
   * stream output is enabled.
   *
   * @param {object} obj The object to be styled for stdout.
   * @returns {UX}
   */
  public styledJSON(obj: object): UX {
    this.logger.info(obj);
    if (this.isOutputEnabled) {
      this.cli.styledJSON(obj);
    }
    return this;
  }

  /**
   * Logs at `INFO` level and conditionally writes to `stdout` in a styled header format if
   * stream output is enabled.
   *
   * @param {string} header The header to be styled.
   * @returns {UX}
   */
  public styledHeader(header: string): UX {
    this.logger.info(header);
    if (this.isOutputEnabled) {
      this.cli.styledHeader(header);
    }
    return this;
  }
}

/**
 * A table option configuration type.  May be a detailed configuration, or
 * more simply just a string array in the simple cases where table header values
 * are the only desired config option.
 */
export type TableOptions = Partial<OclifTableOptions> | string[];

/**
 * A deprecation warning message configuration type.  A typical instance can pass `name`,
 * `type`, and `version` for a standard message.  Alternatively, the `messageOverride` can
 * be used as a special case deprecated message.
 */
export type DeprecationDefinition =
  | {
      name: string;
      // tslint:disable-next-line no-reserved-keywords
      type: string;
      version: number;
      to?: string;
      message?: string;
      messageOverride?: never;
    }
  | {
      name?: never;
      // tslint:disable-next-line no-reserved-keywords
      type?: never;
      version?: never;
      to?: string;
      message?: string;
      messageOverride: string;
    };
