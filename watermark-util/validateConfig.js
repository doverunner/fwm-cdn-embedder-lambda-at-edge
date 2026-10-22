const COMPOSING_TYPES = ['unlabeled_a_variant', 'directory_prefix', 'aws'];
const AES_KEY_LENGTH = 32;

export const validateConfig = (config) => {
    const problems = [];

    if (!COMPOSING_TYPES.includes(String(config.type).toLowerCase())) {
        problems.push(`type must be one of ${COMPOSING_TYPES.join(', ')}, not '${config.type}'`);
    }

    if (AES_KEY_LENGTH !== String(config.aesKey ?? '').length) {
        problems.push(`aesKey must be ${AES_KEY_LENGTH} characters; it is not the site key yet`);
    }

    if ('number' !== typeof config.availableInterval) {
        problems.push('availableInterval must be a number of minutes, or 0 to disable the check');
    }

    const prefixFolders = Array.isArray(config.prefixFolder) ? config.prefixFolder : [config.prefixFolder];
    for (const folder of prefixFolders) {
        if (String(folder).includes('/')) {
            problems.push(`prefixFolder '${folder}' must be a single path segment, without a slash`);
        }
    }

    if (0 < problems.length) {
        console.error('watermark embedder configuration is unusable: ' + problems.join('; '));
    }
}
