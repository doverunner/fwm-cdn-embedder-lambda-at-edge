import crypto from 'node:crypto';

const AES_IV = '0123456789abcdef';

const aesDecrypt = (watermarkData, aesKey) => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, AES_IV);
    let result = decipher.update(watermarkData, "base64", "utf-8");
    result += decipher.final("utf-8");
    return result;
}

const isTokenFresh = (timestamp, interval) => {
    if (0 === interval) {
        return true;
    }
    const now = new Date();
    const checkTime = new Date(timestamp);
    const currentMilliSeconds = now.getTime();
    const checkMilliSeconds = checkTime.getTime();
    const period = (currentMilliSeconds - checkMilliSeconds) / 1000;

    return (interval * 60) > period && period > 0;
}

export default { aesDecrypt, isTokenFresh };
