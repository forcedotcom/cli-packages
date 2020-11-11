/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Command from '@oclif/command';
import { OutputArgs, OutputFlags } from '@oclif/parser';
import {
  ConfigAggregator,
  Global,
  Lifecycle,
  Logger,
  Messages,
  Mode,
  Org,
  SfdxError,
  SfdxProject,
} from '@salesforce/core';
import { env } from '@salesforce/kit';
import { AnyJson, Dictionary, get, isBoolean, JsonMap, Optional } from '@salesforce/ts-types';
import { has } from '@salesforce/ts-types';
import chalk from 'chalk';
import { DocOpts } from './docOpts';
import { buildSfdxFlags, flags as Flags, FlagsConfig } from './sfdxFlags';
import { DeprecationDefinition, TableOptions, UX } from './ux';
import { Deprecation } from './ux';

Messages.importMessagesDirectory(__dirname);

export interface SfdxResult {
  data?: AnyJson;
  tableColumnData?: TableOptions;
  display?: (this: Result) => void;
}

/**
 * A class that handles command results and formatting.  Use this class
 * to override command display behavior or to get complex table formatting.
 * For simple table formatting, use {@link SfdxCommand.tableColumnData} to
 * define a string array of keys to use as table columns.
 */
export class Result implements SfdxResult {
  public data!: AnyJson; // assigned in SfdxCommand._run
  public tableColumnData?: TableOptions;
  public ux!: UX; // assigned in SfdxCommand.init

  public constructor(config: SfdxResult = {}) {
    this.tableColumnData = config.tableColumnData;
    if (config.display) {
      this.display = config.display.bind(this);
    }
  }

  public display(): void {
    if (this.tableColumnData) {
      if (Array.isArray(this.data) && this.data.length) {
        this.ux.table(this.data, this.tableColumnData);
      } else {
        this.ux.log('No results found.');
      }
    }
  }
}

/**
 * Defines a varargs configuration. If set to true, there will be no
 * validation and varargs will not be required.  The validator function
 * should throw an error if validation fails.
 */
export type VarargsConfig =
  | {
      required: boolean;
      validator?: (name: string, value: string) => void;
    }
  | boolean;

/**
 * A base command that provides convenient access to common SFDX flags, a logger,
 * CLI output formatting, scratch orgs, and devhubs.  Extend this command and set
 * various static properties and a flag configuration to add SFDX behavior.
 *
 * @extends @oclif/command
 * @see https://github.com/oclif/command
 */
export abstract class SfdxCommand extends Command {
  // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
  protected get statics(): typeof SfdxCommand {
    return this.constructor as typeof SfdxCommand;
  }

  // Set to true to add the "targetusername" flag to this command.
  protected static supportsUsername = false;

  // Set to true if this command MUST have a targetusername set, either via
  // a flag or by having a default.
  protected static requiresUsername = false;

  // Set to true to add the "targetdevhubusername" flag to this command.
  protected static supportsDevhubUsername = false;

  // Set to true if this command MUST have a targetdevhubusername set, either via
  // a flag or by having a default.
  protected static requiresDevhubUsername = false;

  // Set to true if this command MUST be run within a SFDX project.
  protected static requiresProject = false;

  // Set if this command is deprecated.
  protected static deprecated?: Deprecation;

  // Convenience property for simple command output table formating.
  protected static tableColumnData: string[];

  // Property to inherit, override, and configure flags
  protected static flagsConfig: FlagsConfig;

  // Use for full control over command output formating and display, or to override
  // certain pieces of default display behavior.
  protected static result: SfdxResult = {};

  // Use to enable or configure varargs style (key=value) parameters.
  protected static varargs: VarargsConfig = false;

  protected logger!: Logger; // assigned in init
  protected ux!: UX; // assigned in init

  // A configAggregator for this command to reference; assigned in init
  protected configAggregator!: ConfigAggregator;

  // An org instance for this command to reference.
  protected org?: Org;

  // A hub org instance for this command to reference.
  protected hubOrg?: Org;

  // An SFDX project for this command to reference.
  protected project?: SfdxProject;

  // The command output and formatting; assigned in _run
  protected result!: Result;

  // The parsed flags for easy reference by this command; assigned in init
  protected flags!: OutputFlags<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // The parsed args for easy reference by this command; assigned in init
  protected args!: OutputArgs<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // The parsed varargs for easy reference by this command
  protected varargs?: JsonMap;

  /** event names to be registered for command specific hooks */
  protected readonly lifecycleEventNames: string[] = [];

  private isJson = false;

  public static getVarArgsConfig(): Partial<VarargsConfig> | undefined {
    if (isBoolean(this.varargs)) {
      return this.varargs ? {} : undefined;
    }
    // Don't let others muck with this commands config
    return Object.assign({}, this.varargs);
  }

  public async _run<T>(): Promise<Optional<T>> {
    // If a result is defined for the command, use that.  Otherwise check for a
    // tableColumnData definition directly on the command.
    if (!this.statics.result.tableColumnData && this.statics.tableColumnData) {
      this.statics.result.tableColumnData = this.statics.tableColumnData;
    }
    this.result = new Result(this.statics.result);

    let err: Optional<Error>;
    try {
      await this.init();
      return (this.result.data = await this.run());
    } catch (e) {
      err = e;
      await this.catch(e);
    } finally {
      await this.finally(err);
    }
  }

  // Assign this.project if the command requires to be run from within a project.
  protected async assignProject(): Promise<void> {
    // Throw an error if the command requires to be run from within an SFDX project but we
    // don't have a local config.
    try {
      this.project = await SfdxProject.resolve();
    } catch (err) {
      if (err.name === 'InvalidProjectWorkspace') {
        throw SfdxError.create('@salesforce/command', 'command', 'RequiresProjectError');
      }
      throw err;
    }
  }

  // Assign this.org if the command supports or requires a username.
  protected async assignOrg(): Promise<void> {
    // Create an org from the username and set on this
    try {
      this.org = await Org.create({
        aliasOrUsername: this.flags.targetusername,
        aggregator: this.configAggregator,
      });
      if (this.flags.apiversion) {
        this.org.getConnection().setApiVersion(this.flags.apiversion);
      }
    } catch (err) {
      if (this.statics.requiresUsername) {
        if (err.name === 'NoUsername' || err.name === 'AuthInfoCreationError') {
          throw SfdxError.create('@salesforce/command', 'command', 'RequiresUsernameError');
        }
        throw err;
      }
    }
  }

  // Assign this.hubOrg if the command supports or requires a devhub username.
  protected async assignHubOrg(): Promise<void> {
    // Create an org from the devhub username and set on this
    try {
      this.hubOrg = await Org.create({
        aliasOrUsername: this.flags.targetdevhubusername,
        aggregator: this.configAggregator,
        isDevHub: true,
      });
      if (this.flags.apiversion) {
        this.hubOrg.getConnection().setApiVersion(this.flags.apiversion);
      }
    } catch (err) {
      // Throw an error if the command requires a devhub and there is no targetdevhubusername
      // flag set and no defaultdevhubusername set.
      if (this.statics.requiresDevhubUsername) {
        if (err.name === 'AuthInfoCreationError' || err.name === 'NoUsername') {
          throw SfdxError.create('@salesforce/command', 'command', 'RequiresDevhubUsernameError');
        }
        throw SfdxError.wrap(err);
      }
    }
  }

  protected shouldEmitHelp(): boolean {
    // If -h was given and this command does not define its own flag with `char: 'h'`,
    // indicate that help should be emitted.
    if (!this.argv.includes('-h')) {
      // If -h was not given, nothing else to do here.
      return false;
    }
    // Check each flag config to see if -h has been overridden...
    const flags = this.statics.flags || {};
    for (const k of Object.keys(flags)) {
      if (k !== 'help' && flags[k].char === 'h') {
        // If -h is configured for anything but help, the subclass should handle it itself.
        return false;
      }
    }
    // Otherwise, -h was either not overridden by the subclass, or the subclass includes a specific help flag config.
    return true;
  }

  protected async init(): Promise<void> {
    // If we made it to the init method, the exit code should not be set yet. It will be
    // successful unless the base init or command throws an error.
    process.exitCode = 0;

    // Ensure this.isJson, this.logger, and this.ux are set before super init, flag parsing, or help generation
    // (all of which can throw and prevent these from being available for command error handling).
    const isContentTypeJSON = env.getString('SFDX_CONTENT_TYPE', '').toUpperCase() === 'JSON';
    this.isJson = this.argv.includes('--json') || isContentTypeJSON;

    // Regex match on loglevel flag in argv and set on the root logger so the proper log level
    // is used.  If no match, the default root log level is used.
    // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
    const loglevel = this.argv.join(' ').match(/--loglevel\s*=?\s*([a-z]+)/);
    if (loglevel) {
      (await Logger.root()).setLevel(Logger.getLevelByName(loglevel[1]));
    }

    await this.initLoggerAndUx();

    // If the -h flag is set in argv and not overridden by the subclass, emit help and exit.
    if (this.shouldEmitHelp()) {
      // eslint-disable-next-line no-underscore-dangle
      this._help();
    }

    // Finally invoke the super init now that this.ux is properly configured.
    await super.init();

    // Load messages
    const messages: Messages = Messages.loadMessages('@salesforce/command', 'command');

    // Turn off strict parsing if varargs are set.  Otherwise use static strict setting.
    const strict = this.statics.varargs ? !this.statics.varargs : this.statics.strict;

    // Parse the command to get flags and args
    const { args, flags, argv } = this.parse({
      flags: this.statics.flags,
      args: this.statics.args,
      strict,
    });
    this.flags = flags;
    this.args = args;

    // The json flag was set by the environment variables
    if (isContentTypeJSON) {
      this.flags.json = true;
    }

    this.warnIfDeprecated();

    // If this command supports varargs, parse them from argv.
    if (this.statics.varargs) {
      const argVals: string[] = Object.values(args);
      const varargs = argv.filter((val) => !argVals.includes(val));
      this.varargs = this.parseVarargs(varargs);
    }

    this.logger.info(
      `Running command [${this.statics.name}] with flags [${JSON.stringify(flags)}] and args [${JSON.stringify(args)}]`
    );

    //
    // Verify the command args and flags meet the requirements
    //

    this.configAggregator = await ConfigAggregator.create();

    // Assign this.project if the command requires to be run from within a project.
    if (this.statics.requiresProject) {
      await this.assignProject();
    }

    // Get the apiVersion from the config aggregator and display a warning
    // if it's overridden.
    const apiVersion = this.configAggregator.getInfo('apiVersion');
    if (apiVersion && apiVersion.value && !flags.apiversion) {
      this.ux.warn(messages.getMessage('apiVersionOverrideWarning', [JSON.stringify(apiVersion.value)]));
    }

    // Assign this.org if the command supports or requires a username.
    if (this.statics.supportsUsername || this.statics.requiresUsername) {
      await this.assignOrg();
    }

    // Assign this.hubOrg if the command supports or requires a devhub username.
    if (this.statics.supportsDevhubUsername || this.statics.requiresDevhubUsername) {
      await this.assignHubOrg();
    }

    // register event listeners for command specific hooks
    await this.hooksFromLifecycleEvent(this.lifecycleEventNames);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async catch(err: any): Promise<void> {
    // Let oclif handle exit signal errors.
    if (err.code === 'EEXIT') {
      throw err;
    }

    await this.initLoggerAndUx();

    // Convert all other errors to SfdxErrors for consistency and set the command name on the error.
    const error: SfdxError = err.setCommandName ? err : SfdxError.wrap(err);
    error.setCommandName(this.statics.name);

    process.exitCode = process.exitCode || error.exitCode || 1;

    const userDisplayError = Object.assign(this.getJsonResultObject(error.data, error.exitCode), {
      ...error.toObject(),
      stack: error.stack,
      warnings: Array.from(UX.warnings),
    });

    if (this.isJson) {
      // This should default to true, which will require a major version bump.
      const sendToStdout = env.getBoolean('SFDX_JSON_TO_STDOUT', true);
      if (sendToStdout) {
        this.ux.logJson(userDisplayError);
      } else {
        this.ux.errorJson(userDisplayError);
      }
    } else {
      this.ux.error(...this.formatError(error));

      if (err.data) {
        this.result.data = err.data;
        this.result.display();
      }
    }
    // Emit an event for the analytics plugin.  The ts-ignore is necessary
    // because TS is strict about the events that can be emitted on process.
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    process.emit('cmdError', err, Object.assign({}, this.flags, this.varargs), this.org || this.hubOrg);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async finally(err: Optional<Error>): Promise<void> {
    // Only handle success since we're handling errors in the catch
    if (!err) {
      if (this.isJson) {
        let output = this.getJsonResultObject();
        if (UX.warnings.size > 0) {
          output = Object.assign(output, {
            warnings: Array.from(UX.warnings),
          });
        }
        this.ux.logJson(output);
      } else {
        this.result.display();
      }
    }
  }

  // If this command is deprecated, emit a warning
  protected warnIfDeprecated(): void {
    if (this.statics.deprecated) {
      let def: DeprecationDefinition;
      if (has(this.statics.deprecated, 'version')) {
        def = {
          name: this.statics.name,
          type: 'command',
          ...this.statics.deprecated,
        };
      } else {
        def = this.statics.deprecated;
      }
      this.ux.warn(UX.formatDeprecationWarning(def));
    }

    if (this.statics.flagsConfig) {
      // If any deprecated flags were passed, emit warnings
      for (const flag of Object.keys(this.flags)) {
        const def = this.statics.flagsConfig[flag];
        if (def && def.deprecated) {
          this.ux.warn(
            UX.formatDeprecationWarning({
              name: flag,
              type: 'flag',
              ...def.deprecated,
            })
          );
        }
      }
    }
  }

  protected getJsonResultObject(
    result = this.result.data,
    status = process.exitCode || 0
  ): { status: number; result: AnyJson } {
    return { status, result };
  }

  protected parseVarargs(args: string[] = []): JsonMap {
    const varargs: Dictionary<string> = {};
    const descriptor = this.statics.varargs;

    // If this command requires varargs, throw if none are provided.
    if (!args.length && !isBoolean(descriptor) && descriptor.required) {
      throw SfdxError.create('@salesforce/command', 'command', 'VarargsRequired');
    }

    // Validate the format of the varargs
    args.forEach((arg) => {
      const split = arg.split('=');

      if (split.length !== 2) {
        throw SfdxError.create('@salesforce/command', 'command', 'InvalidVarargsFormat', [arg]);
      }

      const [name, value] = split;

      if (varargs[name]) {
        throw SfdxError.create('@salesforce/command', 'command', 'DuplicateVararg', [name]);
      }

      if (!isBoolean(descriptor) && descriptor.validator) {
        descriptor.validator(name, value);
      }

      varargs[name] = value || undefined;
    });

    return varargs;
  }

  /**
   * Format errors and actions for human consumption. Adds 'ERROR running <command name>',
   * and outputs all errors in red.  When there are actions, we add 'Try this:' in blue
   * followed by each action in red on its own line.
   *
   * @returns {string[]} Returns decorated messages.
   */
  protected formatError(error: SfdxError): string[] {
    const colorizedArgs: string[] = [];
    // We should remove error.commandName since we should always use the actual command id.
    const commandName = this.id || error.commandName;
    const runningWith = commandName ? ` running ${commandName}` : '';
    colorizedArgs.push(chalk.bold(`ERROR${runningWith}: `));
    colorizedArgs.push(chalk.red(error.message));

    // Format any actions.
    if (get(error, 'actions.length')) {
      colorizedArgs.push(`\n\n${chalk.blue(chalk.bold('Try this:'))}`);
      if (error.actions) {
        error.actions.forEach((action) => {
          colorizedArgs.push(`\n${chalk.red(action)}`);
        });
      }
    }
    if (error.stack && Global.getEnvironmentMode() === Mode.DEVELOPMENT) {
      colorizedArgs.push(chalk.red(`\n*** Internal Diagnostic ***\n\n${error.stack}\n******\n`));
    }

    return colorizedArgs;
  }

  /**
   * Initialize logger and ux for the command
   */
  protected async initLoggerAndUx(): Promise<void> {
    if (!this.logger) {
      this.logger = await Logger.child(this.statics.name);
    }
    if (!this.ux) {
      this.ux = new UX(this.logger, !this.isJson);
    }
    if (this.result && !this.result.ux) {
      this.result.ux = this.ux;
    }
  }

  /**
   * register events for command specific hooks
   */
  private async hooksFromLifecycleEvent(lifecycleEventNames: string[]): Promise<void> { // eslint-disable-line @typescript-eslint/require-await, prettier/prettier
    // eslint-disable-line prettier/prettier, @typescript-eslint/require-await
    const options = {
      Command: this.ctor,
      argv: this.argv,
      commandId: this.id,
    };

    const lifecycle = Lifecycle.getInstance();

    lifecycleEventNames.forEach((eventName) => {
      lifecycle.on(eventName, async (result) => {
        await this.config.runHook(eventName, Object.assign(options, { result }));
      });
    });
  }

  // Overrides @oclif/command static flags property.  Adds username flags
  // if the command supports them.  Builds flags defined by the command's
  // flagsConfig static property.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static get flags(): Flags.Input<any> {
    return buildSfdxFlags(this.flagsConfig, {
      targetdevhubusername: !!(this.supportsDevhubUsername || this.requiresDevhubUsername),
      targetusername: !!(this.supportsUsername || this.requiresUsername),
    });
  }

  public static get usage(): string {
    return DocOpts.generate(this);
  }

  /**
   * Actual command run code goes here.
   *
   * @returns {Promise<any>} Returns a promise
   * @throws {Error | SfdxError} Throws an error. If the error is not an SfdxError, it will
   * be wrapped in an SfdxError. If the error contains exitCode field, process.exitCode
   * will set to it.
   */
  public abstract async run(): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
