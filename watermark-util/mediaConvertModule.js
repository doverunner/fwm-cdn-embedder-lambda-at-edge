import wmUtil from './wmUtil.js';

const VARIANT_DIR_DEPTH = 2;

const createWatermarkUrl = (contentPath, prefixFolder = '', watermarkInfo = {}) => {
    let responseUrl = '/' + prefixFolder;

    const queryIndex = contentPath.lastIndexOf('?');
    const fileNameIndex = contentPath.lastIndexOf('/');

    let fileName;
    let queryString;
    if (-1 < queryIndex) {
        fileName = contentPath.substring(fileNameIndex + 1, queryIndex);
        queryString = contentPath.substring(queryIndex);
    } else {
        fileName = contentPath.substring(fileNameIndex + 1);
        queryString = '';
    }

    contentPath = -1 < queryIndex ? contentPath.substring(0, queryIndex) : contentPath;

    const extensionIndex = fileName.lastIndexOf('.');
    const baseName = fileName.substring(0, extensionIndex);
    const extension = fileName.substring(extensionIndex + 1);

    const firstSegmentNumber = watermarkInfo.first_segment_number;
    let segmentNumber;
    let renditionSymbol;

    switch (extension) {
        case 'ts':
            segmentNumber = wmUtil.getSequenceNumber(baseName);
            if (segmentNumber < 0) {
                break;
            }

            renditionSymbol = wmUtil.selectRenditionSymbol(firstSegmentNumber, segmentNumber, watermarkInfo);
            responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH, renditionSymbol);
            break;
        case 'mp4':
        case 'm4s':
            if (baseName.toLowerCase().endsWith('init')) {
                responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH);
            } else {
                segmentNumber = wmUtil.getSequenceNumber(baseName);
                if (segmentNumber < 0) {
                    break;
                }

                renditionSymbol = wmUtil.selectRenditionSymbol(firstSegmentNumber, segmentNumber, watermarkInfo);
                responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH, renditionSymbol);
            }
            break;
        default:
            responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH);
            break;
    }

    if (responseUrl === ('/' + prefixFolder)) {
        responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH);
    }
    responseUrl += queryString;

    return responseUrl;
}

export default { createWatermarkUrl };
