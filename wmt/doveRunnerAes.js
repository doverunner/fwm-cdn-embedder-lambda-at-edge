import watermarkUtil from '../watermark-util/index.js';
import wmUtil from '../watermark-util/wmUtil.js';
import mediaConvertModule from '../watermark-util/mediaConvertModule.js';
import unlabeledAVariantModule from '../watermark-util/unlabeledAVariantModule.js';
import directoryPrefixModule from '../watermark-util/directoryPrefixModule.js';

const getContentUrl = (req, uriSegments, prefixFolder, config, hasRevokeToken) => {
    let watermarkData = uriSegments[2] ?? '';
    watermarkData = watermarkData.replace(/-/gi, '+');
    watermarkData = watermarkData.replace(/_/gi, '/');

    let watermarkInfo;
    try {
        const decWatermarkData = watermarkUtil.aesDecrypt(watermarkData, config.aesKey);
        watermarkInfo = JSON.parse(decWatermarkData);
        console.log('watermark payload: ' + JSON.stringify(watermarkInfo));
    } catch (e) {
        console.error('watermark token rejected : %s', e.message);
        return {status: '403', statusDescription: 'Invalid watermark token'};
    }

    const requestedFileName = req.uri.split('/').pop();
    if (wmUtil.findBlockedPrefix(requestedFileName, watermarkInfo.renditions ?? 2)) {
        return {status: '403', statusDescription: 'Unsafe file path request detected.'};
    }

    if (watermarkInfo.revoke_flag && !hasRevokeToken) {
        return {status: '403', statusDescription: 'Missing required revoke token'};
    }

    if (!watermarkUtil.isTokenFresh(watermarkInfo.timestamp, config.availableInterval)) {
        return {status: '403', statusDescription: 'The watermark token usage period has expired'};
    }

    if ('number' !== typeof watermarkInfo.first_segment_number) {
        return {status: '403', statusDescription: 'Missing required first segment number'};
    }

    let fwmModule;
    const composingType = config.type.toLowerCase();
    if ('aws' === composingType) {
        fwmModule = mediaConvertModule;
    } else if ('unlabeled_a_variant' === composingType) {
        fwmModule = unlabeledAVariantModule;
    } else {
        fwmModule = directoryPrefixModule;
    }

    const contentPath = req.uri.substring(watermarkData.length + 2 + prefixFolder.length);

    req.uri = fwmModule.createWatermarkUrl(contentPath, prefixFolder, watermarkInfo);

    return req;
}

export default { getContentUrl };
