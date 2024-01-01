/**
 * Performs an HTTP request using the JavaScript Fetch API.
 *
 * @param {string} input - The URL to make the request to.
 * @param {Object} init - Additional options for the request.
 * @returns {Promise<Response>} - A promise that resolves with the response to the request.
 * @throws {Error} - If the maximum number of retries is exceeded.
 */

const MAX_NB_RETRY = 5;
const RETRY_DELAY_MS = 200;

function sleep(delay) {
    return new Promise((res, rej) => setTimeout(res, delay));
};

export default async function (input, init) {
    let retryLeft = MAX_NB_RETRY;
    while (retryLeft > 0) {
        try {
            return await fetch(input, init);
        }
        catch (err) {
            await sleep(RETRY_DELAY_MS)
        }
        finally {
            retryLeft -= 1;
        }
    };
    throw new Error("Too many retries");
};

// Code extracted from https://stackoverflow.com/questions/46175660/fetch-retry-request-on-failure