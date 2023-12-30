/**
 * Same as Promise.all(items), but it waits for
 * the first {batchSize} promises to finish before starting the next batch.
 *
 * @param {Promise<T>[]} promises A list of promises to be splitted.
 * @param {int} batchSize
 * @returns {[Promise]}
 */

const MIN_SIZE_BATCH = 10;
export default async function (promises, batchSize = MIN_SIZE_BATCH) {
    let position = 0;
    let results = [];
    while (position < promises.length) {
        console.log("Batch")
        const promisesBatch = promises.slice(position, position + batchSize);
        results = [...results, ...await Promise.all(promisesBatch)];
        position += batchSize;
    }
    return results;
}

// Code adaptted from https://stackoverflow.com/questions/37213316/execute-batch-of-promises-in-series-once-promise-all-is-done-go-to-the-next-bat