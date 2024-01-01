/**
 * It does the same as Promise.all(items), but it waits for
 * the first batch of promises to finish before starting the next batch.
 *
 * @param {Promise[]} promises - An array of promises.
 * @param {number} [batchSize=10] - The desired batch size.
 * @returns {Promise[]} - An array of resolved promise results.
 */

const MIN_SIZE_BATCH = 10;
export default async function (promises, batchSize = MIN_SIZE_BATCH) {
    let position = 0;
    let results = [];
    while (position < promises.length) {
        const promisesBatch = promises.slice(position, position + batchSize);
        results = [...results, ...await Promise.all(promisesBatch)];
        position += batchSize;
    }
    return results;
}

// Code adaptted from https://stackoverflow.com/questions/37213316/execute-batch-of-promises-in-series-once-promise-all-is-done-go-to-the-next-bat