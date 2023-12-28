import pdfkit from "pdfkit";
import blobStream from "blob-stream";

/**
* 
* This function generates a node.js buffer with a PDF file  from a set of images.
* @param {Object[]} imagesInfo - An array with image buffer and ratio.
* @param {Buffer} imagesInfo[].buffer - Buffer of a jpg or png image.
* @param {number} imagesInfo[].ratio - Image ratio. 
*
*/

export default function (imagesInfo) {
    const PAGE_WIDTH = 612;
    const PDF_DOCUMENT = new pdfkit({ autoFirstPage: false });

    // Buffer must refer to a png or jpg file.
    for (let i = 0; i < imagesInfo.length; i++) {
        const newHeight = PAGE_WIDTH / (imagesInfo[i].ratio);
        const size = [PAGE_WIDTH, newHeight];

        PDF_DOCUMENT
            .addPage({ size })
            .image(imagesInfo[i].buffer, 0, 0, { fit: size, align: "center", valign: "center" });
    };

    PDF_DOCUMENT.end();
    const STREAM_REFERENCE = PDF_DOCUMENT.pipe(blobStream());

    return new Promise((res, rej) => {
        STREAM_REFERENCE.on("error", function () {
            rej("Error on chunck transfer.");
        });

        STREAM_REFERENCE.on("finish", async function () {
            res(await this.toBlob());
        });
    });
};