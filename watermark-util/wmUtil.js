import {Buffer} from 'node:buffer';

const INDICATOR_PATTERN = '10001000011000000110000000000000011111111000000000000001100000011';

const INDICATOR_INTERVAL = 3;
const INDICATOR_INDEX = 2;

const WM_PREFIXES = ['', 'b.', 'c.', 'd.'];

const getSequenceNumber = (fileName) => {
    let segmentNumber = -1;

    if (/.*[_-]\d/.test(fileName)) {
        const separatorIndex = Math.max(fileName.lastIndexOf('_'), fileName.lastIndexOf('-'));

        segmentNumber = parseInteger(fileName.substring(separatorIndex + 1));
    }

    return segmentNumber;
}

const parseInteger = (str) => {
    const regExp = /^-?\d+$/;
    if (regExp.test(str)) {
        return Number.parseInt(str, 10);
    } else {
        return -1;
    }
}

const selectRenditionSymbol = (firstSegmentNumber, segmentNumber, watermarkInfo = {}) => {
    const {
        watermark_data: watermarkData = '',
        sync_skip_bit: syncSkipBit = -1,
        renditions = 2,
        lead_in: leadIn = 4
    } = watermarkInfo;
    let alignedSegmentNumber = segmentNumber;

    if (syncSkipBit > -1) {
        alignedSegmentNumber = alignedSegmentNumber + syncSkipBit;
    }

    const bitsPerSegment = Math.log2(renditions);
    const firstMarkedSegment = leadIn + firstSegmentNumber;

    let renditionSymbol = '0';
    if (alignedSegmentNumber >= firstMarkedSegment) {
        let symbolPattern = Buffer.from(watermarkData, 'base64').toString('utf8');

        if (symbolPattern.length < bitsPerSegment) {
            return renditionSymbol;
        }

        const slot = alignedSegmentNumber - firstMarkedSegment;

        if (syncSkipBit > -1 && symbolPattern.length === INDICATOR_PATTERN.length
            && Math.trunc(slot / symbolPattern.length) % INDICATOR_INTERVAL === INDICATOR_INDEX) {
            symbolPattern = INDICATOR_PATTERN;
        }

        const base = (slot * bitsPerSegment) % symbolPattern.length;
        renditionSymbol = bitsPerSegment === 1
            ? symbolPattern.charAt(base)
            : String(Number.parseInt(symbolPattern.substring(base, base + bitsPerSegment), 2));
    }

    return renditionSymbol;
}

const buildVariantDirectoryPath = (contentPath, trailingSegmentCount, renditionSymbol = 0) => {
    let responseUrl = '';
    const pathSegments = contentPath.split('/');
    const pathSegmentCount = pathSegments.length;
    for (let i = 1; i < pathSegmentCount; i++) {
        if (i === (pathSegmentCount - trailingSegmentCount)) {
            responseUrl += '/' + renditionSymbol;
        }
        responseUrl += '/' + pathSegments[i];
    }
    return responseUrl;
}

const buildVariantFilePath = (path, fileName, renditionSymbol = '0') => {
    const prefix = WM_PREFIXES[Number.parseInt(renditionSymbol, 10)] || '';
    return path + prefix + fileName;
}

const findBlockedPrefix = (fileName, renditions) => {
    const blocked = WM_PREFIXES.slice(1, Number(renditions) === 4 ? 4 : 2);
    return blocked.find((prefix) => fileName.startsWith(prefix));
}

const removeRevokeToken = (uriSegments) => {
    const watermarkData = uriSegments[2].split('.');
    const hasRevokeToken = watermarkData.length >= 2;

    if (hasRevokeToken) {
        uriSegments[2] = watermarkData[1];
    }
    return {
        modifiedUriSegments: uriSegments,
        hasRevokeToken
    };
};

export default {
    findBlockedPrefix,
    getSequenceNumber,
    parseInteger,
    selectRenditionSymbol,
    buildVariantDirectoryPath,
    buildVariantFilePath,
    removeRevokeToken,
    WM_PREFIXES
}
