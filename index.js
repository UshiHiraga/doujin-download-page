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
app.use(express.urlencoded());

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
        let type = "jpg";
        let orientation = "horizontal";
        switch (e.t) {
            case "j": type = "jpg"; break;
            case "p": type = "png"; break;
            case "g": type = "gif"; break;
        }

        if (e.w < e.h) orientation = "vertical"

        return {
            type,
            width: e.w,
            heigth: e.h,
            orientation
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
        num_pages: original_data.num_pages,
        pages: original_data.images.pages.map(extractImageTypeInfo)
    }
}

app.get("/", function (req, res) {
    res.render('index', { "code": "" });
});

app.post("/getInfoByCode", async function (req, res) {

    console.log("Here")
    // Check value
    if (!req.body.code || req.body.code === "") {
        console.log("NO valid")
        res.send(JSON.stringify({ "error": "Invalid input" }))
    }

    console.log("seach")
    const thisDoujinCode = req.body.code;

    let dataFromNhentai = "";
    if (!db.data[thisDoujinCode]) {
        

        dataFromNhentai = await getInfoFromNhentai(`https://nhentai.net/g/${req.body.code}`);
        console.log(dataFromNhentai)

        db.data[dataFromNhentai.media_id] = dataFromNhentai;
        await db.write();
    } else {
        console.log("exist")
        dataFromNhentai = db.data[thisDoujinCode];
    }

    res.send(JSON.stringify(dataFromNhentai));
})

app.get("/g/:code", async function (req, res) {

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