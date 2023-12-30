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
    throw new Error(`Too many retries`);
};

// Code extracted from https://stackoverflow.com/questions/46175660/fetch-retry-request-on-failure