import * as oclifTest from '@oclif/test';
import { command, Config, expect, FancyTypes } from '@oclif/test';
import { AuthFields, SfdxProject } from '@salesforce/core';
import { TestContext, testSetup } from '@salesforce/core/lib/testSetup';
import { AnyJson, definiteValuesOf, Dictionary, ensure, ensureString, JsonMap } from '@salesforce/ts-types';

// Need to prevent typescript error
import * as IConfig from '@oclif/config/lib/config';
import { loadConfig } from '@oclif/test/lib/load-config';

loadConfig.root = ensure(module.parent).filename;

const $$ = testSetup();

const withOrg = (org: Partial<AuthFields> = {}, setAsDefault = true) => {
  return {
    // tslint:disable-next-line:no-any TODO: properly type the dictionary
    run(ctx: Dictionary<any>) {
      if (!ctx.orgs) {
        ctx.orgs = {};
      }

      if (!org.username) {
        org.username = 'test@org.com';
      }

      // Override org if it exists on context
      ctx.orgs[org.username] = Object.assign(
        {
          orgId: '0x012123',
          instanceUrl: 'http://na30.salesforce.com',
          loginUrl: 'https://login.salesforce.com',
          created: '1519163543003',
          isDevHub: false
        },
        org
      );

      ctx.orgs[org.username].default = setAsDefault;

      const readOrg = async function(this: { path: string }) {
        const path = this.path;
        const foundOrg = find(ctx.orgs, val => {
          return path.indexOf(ensureString(val.username)) >= 0;
        });
        return foundOrg;
      };
      const writeOrg = async function(this: { path: string }) {
        const path = this.path;
        const foundOrg = find(ctx.orgs, val => {
          return path.indexOf(ensureString(val.username)) >= 0;
        });
        return (ensure($$.configStubs.AuthInfoConfig).contents = foundOrg);
      };

      $$.configStubs.AuthInfoConfig = {
        retrieveContents: readOrg,
        updateContents: writeOrg
      };
      const defaultOrg = find(ctx.orgs, o => !!o.default && !o.isDevHub);
      const defaultDevHubOrg = find(ctx.orgs, o => !!o.default && !!o.isDevHub);
      $$.configStubs.Config = {
        contents: {
          defaultusername: defaultOrg && defaultOrg.username,
          defaultdevhubusername: defaultDevHubOrg && defaultDevHubOrg.username
        }
      };
    }
  };
};

function find(orgs: Dictionary<JsonMap>, predicate: (val: JsonMap) => boolean): JsonMap {
  return ensure(definiteValuesOf(orgs).filter(predicate)[0]);
}

const withConnectionRequest = (fakeFunction: (request: AnyJson, options?: AnyJson) => Promise<AnyJson>) => {
  return {
    run(ctx: Dictionary) {
      $$.fakeConnectionRequest = fakeFunction;
    }
  };
};

const withProject = (sfdxProjectJson?: JsonMap) => {
  return {
    run(ctx: Dictionary) {
      $$.SANDBOX.stub(SfdxProject, 'resolveProjectPath').callsFake((path: string) => {
        return $$.localPathRetriever(path || $$.id);
      });
      const DEFAULT_PROJECT_JSON = {
        sfdcLoginUrl: 'https://login.salesforce.com'
      };
      $$.configStubs.SfdxProjectJson = {
        contents: Object.assign({}, DEFAULT_PROJECT_JSON, sfdxProjectJson)
      };
    }
  };
};

const test = oclifTest.test
  .register('withOrg', withOrg)
  .register('withConnectionRequest', withConnectionRequest)
  .register('withProject', withProject);

export default test;

export { expect, FancyTypes, Config, command, loadConfig, IConfig, test, $$, TestContext };
