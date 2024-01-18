/**
 * A module that exports functions to convert between Buffer and string.
 * @module BufferString
 */

/**
 * Converts a Buffer to a base64 string.
 * @param {Buffer} buffer - The buffer to convert.
 * @returns {string} The hexadecimal representation of the buffer.
 */
function buf2str(buffer) {
    return buffer.toString("base64");
}

/**
 * Converts a base64 string to a Buffer.
 * @param {string} string - The string to convert.
 * @returns {Buffer} The buffer representation of the hexadecimal string.
 */
function str2buf(string) {
    return Buffer(string, "base64");
}

export const BufferString = {
    buf2str,
    str2buf,
};