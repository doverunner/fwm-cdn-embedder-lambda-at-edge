import wmUtil from './wmUtil.js';

const createWatermarkUrl = (contentPath, prefixFolder = '', watermarkInfo = {}) => {
    let responseUrl = '';

    if ('' !== prefixFolder) {
        responseUrl = '/' + prefixFolder;
    }

    const queryIndex = contentPath.lastIndexOf('?');
    const fileNameIndex = contentPath.lastIndexOf('/');
    const directoryPath = contentPath.substring(0, fileNameIndex + 1);

    let fileName;
    let queryString;
    if (-1 < queryIndex) {
        fileName = contentPath.substring(fileNameIndex + 1, queryIndex);
        queryString = contentPath.substring(queryIndex);
    } else {
        fileName = contentPath.substring(fileNameIndex + 1);
        queryString = '';
    }

    const extensionIndex = fileName.lastIndexOf('.');
    const baseName = fileName.substring(0, extensionIndex);
    const extension = fileName.substring(extensionIndex + 1);

    let markedFileUrl = '';
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
            markedFileUrl = wmUtil.buildVariantFilePath(directoryPath, fileName, renditionSymbol);
            break;
        case 'mp4':
        case 'm4s':
            if (baseName.endsWith('_init')) {
                break;
            }

            segmentNumber = wmUtil.getSequenceNumber(baseName);
            if (segmentNumber < 0) {
                break;
            }

            renditionSymbol = wmUtil.selectRenditionSymbol(firstSegmentNumber, segmentNumber, watermarkInfo);
            markedFileUrl = wmUtil.buildVariantFilePath(directoryPath, fileName, renditionSymbol);
            break;
        default:
            break;
    }

    if ('' === markedFileUrl) {
        markedFileUrl = directoryPath + fileName;
    }

    responseUrl += markedFileUrl + queryString;

    return responseUrl;
}

export default { createWatermarkUrl };
