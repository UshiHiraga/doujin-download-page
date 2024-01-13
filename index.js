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
    const client = new ZenRows(process.env.CLOUDFARE_SCRAPER_API_KEY);
    const { data } = await client.get(nhentaiUrl, { "js_render": "true", "wait_for": "#cover" });

    let tree = cheerio(data);
    let inner = tree("script").toArray();

    let script = inner.find((e) => tree(e).text().includes("window._gallery"));
    let script_text = tree(script).text();
    script_text = script_text.replace("window._gallery = JSON.parse(\"", "").replace("\");", "");
    script_text = script_text.replace(/\\u0022/g, "\"").replace(/\n/g, "").replace(/\t/g, "");
    const original_data = JSON.parse(script_text);

    function extractImageTypeInfo(e) {
        const IMAGES_EXTENSIONS = {
            "j": "jpg",
            "p": "png",
            "g": "gif"
        }

        return {
            type: IMAGES_EXTENSIONS[e.t] || "jpg",
            ratio: e.w / e.h
        };
    };

    function replaceHandler(match) {
        const unicode_point_hex_value = parseInt(match.replace(/\\u/, ""), 16);
        return String.fromCodePoint(unicode_point_hex_value);
    };

    return {
        repo_id: String(original_data.media_id),
        media_id: String(original_data.id),
        title: original_data.title.pretty.replace(/\\u[A-Fa-f0-9]{4}/g, replaceHandler),
        pages: original_data.images.pages.map(extractImageTypeInfo)
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
        //{ "type": "jpg", "width": 1075, "heigth": 1522, "orientation": "vertical" }

        const base_link = "https://i.nhentai.net";
        const url = `${base_link}/galleries/${converted.repo_id}/${i + 1}.${e.type}`;

        let fff = await retryFetch(url);
        return await fff.arrayBuffer();
    }), 5);

    let solve = await ddd;
    console.log(solve);


    // let tyys = solve.map(async (e) => {
    //     let yu = sharp(e);

    //     let metada = await yu.metadata();

    //     return yu.jpeg().toBuffer();
    // });

    // ddd contanins buffers

    let prev_final = Promise.all(solve.map(async (e, i) => {

        let fggsui = await sharp(e).jpeg().toBuffer();

        return {
            buffer: fggsui,
            ratio: converted.pages[i].width / converted.pages[i].heigth
        }
    }))

    let jjsj = await prev_final
    // console.log(jjsj);

    let pdfresult = await createDocument(jjsj);
    console.log(pdfresult);


    res.type("application/pdf")
    pdfresult.arrayBuffer().then((buf) => {
        res.send(Buffer.from(buf))
    })


});

app.listen(port, function () {
    console.log("App has started.");
});