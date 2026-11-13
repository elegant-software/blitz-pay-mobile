const { withProjectBuildGradle, withGradleProperties } = require('expo/config-plugins');

module.exports = function withAndroidBuildConfig(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((item) => item.key !== 'android.jetifier.ignorelist');
    mod.modResults.push({ type: 'property', key: 'android.jetifier.ignorelist', value: 'jackson-core' });
    return mod;
  });
  return withProjectBuildGradle(config, (mod) => {
    const marker = '// Merchant native build adjustments';
    if (!mod.modResults.contents.includes(marker)) {
      const adjustments = `
${marker}
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
    subprojects { subproject ->
        ['com.android.application', 'com.android.library'].each { pluginId ->
            subproject.plugins.withId(pluginId) {
                subproject.extensions.getByName('androidComponents').finalizeDsl { android ->
                    def arguments = android.defaultConfig.externalNativeBuild.cmake.arguments
                    arguments.removeAll { it.startsWith('-DCMAKE_OBJECT_PATH_MAX=') }
                    arguments.add('-DCMAKE_OBJECT_PATH_MAX=250')
                    if (pluginId == 'com.android.application') {
                        android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootProject.projectDir, "../../.cxx/merchant")
                    }
                }
            }
        }
    }
}

subprojects { subproject ->
    if (subproject.name == 'expo-updates') {
        subproject.plugins.withId('com.android.library') {
            subproject.android.defaultConfig.minSdk = rootProject.ext.minSdkVersion
            subproject.android.ndkVersion = rootProject.ext.ndkVersion
        }
    }
}
`;
      mod.modResults.contents = mod.modResults.contents.replace(
        'apply plugin: "expo-root-project"',
        `${adjustments}\napply plugin: "expo-root-project"`,
      );
    }
    return mod;
  });
};
