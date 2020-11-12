import {BaseCommand}                from '@yarnpkg/cli';
import {Configuration, MessageName} from '@yarnpkg/core';
import {StreamReport}               from '@yarnpkg/core';
import {npmHttpUtils}               from '@yarnpkg/plugin-npm';
import {Command, Usage}             from 'clipanion';

import {getRegistryConfiguration}   from './login';

// eslint-disable-next-line arca/no-default-export
export default class NpmWhoamiCommand extends BaseCommand {
  @Command.String(`-s,--scope`, {description: `Print username for the registry configured for a given scope`})
  scope?: string;

  @Command.Boolean(`--publish`, {description: `Print username for the publish registry`})
  publish: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `display the name of the authenticated user`,
    details: `
      Print the username associated with the current authentication settings to the standard output.

      When using \`-s,--scope\`, the username printed will be the one that matches the authentication settings of the registry associated with the given scope (those settings can be overriden using the \`npmRegistries\` map, and the registry associated with the scope is configured via the \`npmScopes\` map).

      When using \`--publish\`, the registry we'll select will by default be the one used when publishing packages (\`publishConfig.registry\` or \`npmPublishRegistry\` if available, otherwise we'll fallback to the regular \`npmRegistryServer\`).
    `,
    examples: [[
      `Print username for the default registry`,
      `yarn npm whoami`,
    ], [
      `Print username for the registry on a given scope`,
      `yarn npm whoami --scope company`,
    ]],
  });

  @Command.Path(`npm`, `whoami`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const registry = await getRegistryConfiguration({
      configuration,
      cwd: this.context.cwd,
      publish: this.publish,
      scope: this.scope,
    });

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      try {
        const response = await npmHttpUtils.get(`/-/whoami`, {
          configuration,
          registry,
          authType: npmHttpUtils.AuthType.ALWAYS_AUTH,
          jsonResponse: true,
        });

        report.reportInfo(MessageName.UNNAMED, response.username);
      } catch (err) {
        if (err.name !== `HTTPError`) {
          throw err;
        } else if (err.response.statusCode === 401 || err.response.statusCode === 403) {
          report.reportError(MessageName.AUTHENTICATION_INVALID, `Authentication failed - your credentials may have expired`);
        } else {
          report.reportError(MessageName.AUTHENTICATION_INVALID, err.toString());
        }
      }
    });

    return report.exitCode();
  }
}
