import wmUtil from './wmUtil.js';

const VARIANT_DIR_DEPTH = { MEDIA_SEGMENT: 5, SUBTITLE: 4, MANIFEST: 2 };

const FLAG_FOLDERS = ['dash', 'hls', 'cmaf'];

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
    const directoryPath = contentPath.substring(0, fileNameIndex);

    const firstSegmentNumber = watermarkInfo.first_segment_number;
    let segmentNumber;
    let renditionSymbol;

    switch (extension) {
        case 'mpd':
            responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.MANIFEST);
            break;
        case 'm3u8':
            if (-1 < fileName.indexOf('master')) {
                responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.MANIFEST);
            } else if ('stream.m3u8' === fileName || 'iframes.m3u8' === fileName) {
                responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.MEDIA_SEGMENT);
            } else if ('subtitle.m3u8' === fileName) {
                responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.SUBTITLE);
            }
            break;
        case 'ts':
            segmentNumber = wmUtil.getSequenceNumber(baseName);
            if (segmentNumber < 0) {
                break;
            }

            renditionSymbol = wmUtil.selectRenditionSymbol(firstSegmentNumber, segmentNumber, watermarkInfo);
            responseUrl += wmUtil.buildVariantDirectoryPath(
                contentPath, VARIANT_DIR_DEPTH.MEDIA_SEGMENT, renditionSymbol
            );
            break;
        case 'm4s':
        case 'mp4':
            if (baseName.endsWith('init')) {
                responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.MEDIA_SEGMENT);
            } else if (isSubtitlePath(directoryPath)) {
                responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.SUBTITLE);
            } else {
                segmentNumber = wmUtil.getSequenceNumber(baseName);
                if (segmentNumber < 0) {
                    break;
                }

                renditionSymbol = wmUtil.selectRenditionSymbol(firstSegmentNumber, segmentNumber, watermarkInfo);
                responseUrl += wmUtil.buildVariantDirectoryPath(
                    contentPath, VARIANT_DIR_DEPTH.MEDIA_SEGMENT, renditionSymbol
                );
            }
            break;
        case 'vtt':
            responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.SUBTITLE);
            break;
        case 'aac':
            responseUrl += wmUtil.buildVariantDirectoryPath(contentPath, VARIANT_DIR_DEPTH.MEDIA_SEGMENT);
            break;
        default:
            break;
    }

    if (responseUrl === ('/' + prefixFolder)) {
        responseUrl += buildDefaultPath(contentPath);
    }
    responseUrl += queryString;

    return responseUrl;
}

const buildDefaultPath = (contentPath) => {
    let responseUrl = '';
    const pathSegments = contentPath.split('/');

    for (let i = 1; i < pathSegments.length; i++) {
        if (FLAG_FOLDERS.includes(pathSegments[i])) {
            responseUrl += '/0';
        }
        responseUrl += '/' + pathSegments[i];
    }
    return responseUrl;
}

const isSubtitlePath = (directoryPath) => {
    const pathSegments = directoryPath.split('/');
    return 'subtitle' === pathSegments[pathSegments.length - 2];
}

export default { createWatermarkUrl };
