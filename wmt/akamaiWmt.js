import {Buffer} from 'node:buffer';
import crypto from 'node:crypto';
import unlabeledAVariantModule from '../watermark-util/unlabeledAVariantModule.js';
import wmUtil from '../watermark-util/wmUtil.js';

const getContentUrl = async (req, uriSegments, config) =>{
    if (!config.wmtPublicKey || !config.wmtPassword) {
        console.error('Please set wmtPublicKey or wmtPassword in config.js.');
        return {status: '403', statusDescription: 'Watermark token support is not configured'};
    }
    if ('unlabeled_a_variant' !== config.type.toLowerCase()) {
        console.error('AkamaiWmt supports only unlabeled_a_variant.');
        return {status: '403', statusDescription: 'Watermark token support is not configured'};
    }

    const jwt = uriSegments[1].substring(4);

    const watermark = await parseWatermarkToken(jwt, config.wmtPublicKey, config.wmtPassword);

    if (!watermark) {
        return {status: '403', statusDescription: 'Invalid watermark token'};
    }

    const requestedFileName = req.uri.split('/').pop();
    if (wmUtil.findBlockedPrefix(requestedFileName, 2)) {
        return {status: '403', statusDescription: 'Unsafe file path request detected.'};
    }

    const contentPath = req.uri.substring(uriSegments[1].length + 1);

    const firstSegmentNumber = /\.ts(\?|$)/i.test(contentPath) ? 1 : 0;

    req.uri = unlabeledAVariantModule.createWatermarkUrl(contentPath, '', {
        watermark_data: Buffer.from(watermark).toString('base64'),
        sync_skip_bit: -1, renditions: 2, lead_in: 0,
        first_segment_number: firstSegmentNumber
    });

    return req;
}

const parseWatermarkToken = async (jwt, wmtPublicKey, passwd) => {
    let watermarkData;
    let step = 'signature verification';
    try {
        if (!(await hasValidSignature(jwt, wmtPublicKey))) {
            throw new Error('signature does not match the configured wmtPublicKey');
        }

        const payload = getPayloadFromJwt(jwt);

        step = 'payload decryption';

        const aesKey = crypto.createHash('sha256').update(passwd).digest();
        const aesIv = Buffer.from(payload['wmidivb64'], 'base64');

        const cipher = crypto.createDecipheriv('aes-256-cbc', aesKey, aesIv);

        let binaryPattern = cipher.update(payload['wmidctb64'], 'base64', 'utf8');
        binaryPattern += cipher.final("utf-8");
        binaryPattern = binaryPattern.replace(/A/gi, '0').replace(/B/gi, '1');
        watermarkData = binaryPattern;
        console.log('watermark pattern: ' + watermarkData);
    } catch (e) {
        console.error(`akamai watermark token rejected at ${step}: ${e.message}`);
    }
    return watermarkData;
}

const getSecuredInputFromJwt = (jwt) => jwt.split('.', 2).join('.');

const getSignatureFromJwt = (jwt) =>jwt.split('.')[2];

const getPayloadFromJwt = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'));

const hasValidSignature = async (jwt, wmtPublicKey) => {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(getSecuredInputFromJwt(jwt));

    return verifier.verify(wmtPublicKey, getSignatureFromJwt(jwt), 'base64');
}

export default { getContentUrl };
