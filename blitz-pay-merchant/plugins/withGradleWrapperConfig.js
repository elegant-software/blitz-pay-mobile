const { withDangerousMod } = require('expo/config-plugins');
const { readFile, writeFile } = require('node:fs/promises');
const { join } = require('node:path');

module.exports = function withGradleWrapperConfig(config) {
  return withDangerousMod(config, ['android', async (mod) => {
    const wrapper = join(mod.modRequest.platformProjectRoot, 'gradle', 'wrapper', 'gradle-wrapper.properties');
    const contents = await readFile(wrapper, 'utf8');
    // AGP 9.2.1 reports: "Minimum supported Gradle version is 9.4.1."
    const updated = contents.replace(
      /^distributionUrl=.*$/m,
      'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip',
    );
    if (updated !== contents) await writeFile(wrapper, updated);
    return mod;
  }]);
};
