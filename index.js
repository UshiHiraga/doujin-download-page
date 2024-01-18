import express from "express";
import sharp from "sharp";
import { load as cheerio } from "cheerio";
import { JSONFilePreset as createDatabase } from "lowdb/node"
import { BufferString as bufstr } from "./lib/buffer-string.js";
import createDocument from "./lib/image-to-pdf.js";
import retryFetch from "./lib/retryable-fetch.js";
import batchPromise from "./lib/batch-promise.js";

const app = express();
const port = 3721;

const db = await createDatabase("db.json", {});
const images = await createDatabase("images.json", {});

app.set("view engine", "ejs");
app.use(express.static("public"));

async function getInfoFromNhentai(nhentaiUrl) {
    const MEDIA_ID_REGEX = /(?<=galleries\/)\d+(?=\/cover)/gm;
    const PRETTY_TITLE_REGEX = /download (.*?),/
    const IMAGE_EXTENSION_REGEX = /\w{3}$/;
    const NORMAL_ID_REGEX = /(?<=\/g\/)\d+(?=\/1\/)/;

    const dataPage = await (await retryFetch(nhentaiUrl)).text();
    const tree = cheerio(dataPage);

    function extractImagesMetadata(e) {
        return {
            type: tree(e).attr("data-src").match(IMAGE_EXTENSION_REGEX)[0],
            ratio: Number(tree(e).attr("width")) / Number(tree(e).attr("height"))
        };
    };

    return {
        repo_id: tree("img", "#cover").attr("src").match(MEDIA_ID_REGEX)[0],
        media_id: tree("a", "#cover").attr("href").match(NORMAL_ID_REGEX)[0],
        title: tree("meta[name='description']").attr("content").match(PRETTY_TITLE_REGEX)[1],
        pages: tree("img.lazyload", "#thumbnail-container").toArray().map(extractImagesMetadata)
    }
}

app.get("/", function (req, res) {
    res.render("index", { "code": "", "result": null })
});

app.get(["/g/:code", "/g"], async function (req, res) {
    const ONLY_NUMBER_REGEX = /^[0-9]+$/gm;
    const NHENTAI_URL_CODE = /\d+/gm
    const NHENTAI_URL_FORMAT = /https:\/\/nhentai\.net\/g\/\d+./gm;

    // Make checking
    const incomingCode = req.params.code || req.query.code;
    let definitiveCode;
    if (ONLY_NUMBER_REGEX.test(incomingCode)) {
        definitiveCode = incomingCode;
    } else if (NHENTAI_URL_FORMAT.test(incomingCode)) {
        definitiveCode = (NHENTAI_URL_CODE.exec(incomingCode))[0];
    } else {
        return res.status(400).render("error");
    }

    console.log(definitiveCode)
    let dataFromNhentai = "";
    if (db.data[definitiveCode]) {
        console.log("Requested doujin data obtained from local storage.");
        dataFromNhentai = db.data[definitiveCode];
    } else {
        console.log("Requested doujin data obtained from internet.");
        dataFromNhentai = await getInfoFromNhentai(`https://nhentai.to/g/${definitiveCode}`);
        await db.update((data) => data[dataFromNhentai.media_id] = dataFromNhentai);
    }

    res.render("index", { "code": definitiveCode, "result": dataFromNhentai })
})

app.get("/download/:code", async function (req, res) {

    const thisDoujinCode = req.params.code
    const ONLY_NUMBER_REGEX = /^[0-9]+$/gm;
    // Checking info or fetching from hnentai.net
    if (!ONLY_NUMBER_REGEX.test(thisDoujinCode) || !db.data[thisDoujinCode]) {
        return res.status(400).render("error");
    }


    let converted = db.data[thisDoujinCode];
    console.log("Getted from db");

    // download Images
    let ddd = batchPromise(converted.pages.map(async (e, i) => {

        const url = `https://i.nhentai.net/galleries/${converted.repo_id}/${i + 1}.${e.type}`;

        let fff = await retryFetch(url);

        let xd = fff.clone();
        let fff_text = await xd.text();

        let fff_bufffer = await fff.arrayBuffer();

        console.log(fff_text);
        console.log(await sharp(fff_bufffer).metadata())

        let buffer = (converted.pages[i].type !== "gif") ? fff_bufffer : await sharp(fff_bufffer).jpeg().toBuffer();

        return {
            buffer,
            ratio: converted.pages[i].ratio
        }
    }), 5);

    let solve = await ddd;
    let pdfresult = await createDocument(solve);

    res.type("application/pdf").end(pdfresult);
});

app.get("/cover/:repo_id/:format", async function (req, res) {
    const repo_id = req.params.repo_id;
    const format = req.params.format;

    let responseImageBuffer = "";
    if (images.data[repo_id]) {
        console.log("Requested cover image got from local storage.");
        responseImageBuffer = bufstr.str2buf(images.data[repo_id]);
    } else {
        console.log("Requested cover image got from internet.");
        const imageLink = `https://t3.nhentai.net/galleries/${repo_id}/1t.${format}`;
        const bufferResponse = await (await fetch(imageLink)).arrayBuffer();
        responseImageBuffer = Buffer.from(bufferResponse);
        await images.update((data) => data[repo_id] = bufstr.buf2str(responseImageBuffer));
    }

    return res.type("image/*").end(responseImageBuffer);
})

app.use(function (req, res, next) {
    res.status(404).render("not_found");
});

export default app;