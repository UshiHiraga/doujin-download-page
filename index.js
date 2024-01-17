import express from "express";
import sharp from "sharp";
import { ZenRows } from "zenrows";
import { load as cheerio } from "cheerio";
import { JSONFilePreset as createDatabase } from "lowdb/node"
import createDocument from "./lib/image-to-pdf.js";
import retryFetch from "./lib/retryable-fetch.js";
import batchPromise from "./lib/batch-promise.js";

const app = express();
const port = 3721;
const db = await createDatabase("db.json", {});

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
    const incomingCode = req.params.code || req.query.code;
    console.log(incomingCode)
    // Make checking

    const ONLY_NUMBER_REGEX = /^[0-9]+$/gm;
    const NHENTAI_URL_CODE = /\d+/gm
    const NHENTAI_URL_FORMAT = /https:\/\/nhentai\.net\/g\/\d+./gm;

    let definitiveCode;
    if (ONLY_NUMBER_REGEX.test(incomingCode)) {
        definitiveCode = incomingCode;
    } else if (NHENTAI_URL_FORMAT.test(incomingCode)) {
        definitiveCode = (NHENTAI_URL_CODE.exec(incomingCode))[0];
    } else {
        return res.send("error");
    }

    console.log(definitiveCode)



    let dataFromNhentai = "";
    if (!db.data[definitiveCode]) {
        console.log("gettin")
        dataFromNhentai = await getInfoFromNhentai(`https://nhentai.net/g/${definitiveCode}`);
        db.data[dataFromNhentai.media_id] = dataFromNhentai;
        await db.write();
    } else {
        console.log("exist")
        dataFromNhentai = db.data[definitiveCode];
    }

    res.render("index", { "code": definitiveCode, "result": dataFromNhentai })
})

app.get("/download/:code", async function (req, res) {

    const thisDoujinCode = req.params.code

    // Checking info or fetching from hnentai.net
    if (!db.data[thisDoujinCode]) {
        console.log("Handle this")
    }


    let converted = db.data[thisDoujinCode];
    console.log("Getted from db");

    // download Images
    let ddd = batchPromise(converted.pages.map(async (e, i) => {

        const base_link = "https://i.nhentai.net";
        const url = `${base_link}/galleries/${converted.repo_id}/${i + 1}.${e.type}`;

        let fff = await retryFetch(url);
        let fff_bufffer = await fff.arrayBuffer();

        let buffer = (converted.pages[i].type !== "gif") ? fff_bufffer : await sharp(fff_bufffer).jpeg().toBuffer();

        return {
            buffer,
            ratio: converted.pages[i].ratio
        }
    }), 5);

    let solve = await ddd;
    let pdfresult = await createDocument(solve);
    console.log(pdfresult);


    res.type("application/pdf").send(pdfresult);
});

app.get("/cover/:repo_id", async function (req, res) {
    let imageLink = `https://t3.nhentai.net/galleries/${req.params.repo_id}/cover.jpg`;
    let bufferResponse = await (await fetch(imageLink)).arrayBuffer();
    res.type("image/jpeg").send(Buffer.from(bufferResponse));
})

app.listen(port, function () {
    console.log("App has started.");
});