import {config} from './config.js';
import doveRunnerAes from './wmt/doveRunnerAes.js';
import akamaiWmt from './wmt/akamaiWmt.js';
import wmUtil from './watermark-util/wmUtil.js';
import {validateConfig} from './watermark-util/validateConfig.js';

validateConfig(config);

const isWatermarkedPrefix = (requestPrefixFolder) => {
    const {prefixFolder} = config;
    if (Array.isArray(prefixFolder)) {
        return prefixFolder.includes(requestPrefixFolder);
    } else {
        return prefixFolder === requestPrefixFolder;
    }
}

export const handler = async (event) => {
    let request = event.Records[0].cf.request;
    console.log('request: ' + request.uri);

    try {
        let uriSegments = request.uri.split('/');
        const prefixFolder = uriSegments[1];

        if (prefixFolder.startsWith('wmt:')) {
            request = await akamaiWmt.getContentUrl(request, uriSegments, config);
        } else if (isWatermarkedPrefix(prefixFolder)) {
            const { modifiedUriSegments, hasRevokeToken } = wmUtil.removeRevokeToken(uriSegments);
            uriSegments = modifiedUriSegments;
            request.uri = '/' + uriSegments.slice(1).join('/');

            request = doveRunnerAes.getContentUrl(request, uriSegments, prefixFolder, config, hasRevokeToken);
        }
    } catch (e) {
        console.error('watermark request rejected: ' + e.message);
        return {status: '403', statusDescription: 'Invalid watermark request'};
    }

    console.log('response: ' + (request.uri ?? `${request.status} ${request.statusDescription}`));

    return request;
}
