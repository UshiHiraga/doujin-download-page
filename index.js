import express from "express";
import createDocument from "./lib/image-to-pdf.js";
import { ZenRows } from "zenrows";
import { load as cheerio } from "cheerio";
import sharp from "sharp";
import { write, writeFile } from "fs";

const app = express();
const port = 3721;

function GetMetadataAndTransform() {



    const scripts_array = Array.from(document.querySelectorAll("script"));
    let script_text = scripts_array.find((e) => e.innerText.includes("window._gallery")).innerText;
    if (!script_text) throw new Error("No pudimos encontrar los datos.");




    return
};



app.set("view engine", "ejs");

app.get("/", function (req, res) {
    res.render('index', { foo: 'FOO' });
});

app.get("/g/:code", async function (req, res) {
    // res.render('download', { code: req.params.code });

    const thisDoujinCode = req.params.code

    // getInfo
    // getLinks
    // downloadImages
    // createPDF

    // Fetching nhentai page
        const client = new ZenRows(process.env.CLOUDFARE_SCRAPER_API_KEY);
        const { data } = await client.get(`https://nhentai.net/g/${thisDoujinCode}`, { "js_render": "true", "wait_for": "#cover" });
        console.log(data);

  

    // Getting info
    let tree = cheerio(data);
    let inner = tree("script").toArray();

    let scri = inner.find((e) => tree(e).text().includes("window._gallery"));
    let script_text = tree(scri).text();
    script_text = script_text.replace("window._gallery = JSON.parse(\"", "").replace("\");", "");
    script_text = script_text.replace(/\\u0022/g, "\"").replace(/\n/g, "").replace(/\t/g, "");
    const original_data = JSON.parse(script_text);

    function ConvertOriginalToImage(e) {
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


    let converted = {
        repo_id: String(original_data.media_id),
        media_id: String(original_data.id),
        title: original_data.title.pretty.replace(/\\u[A-Fa-f0-9]{4}/g, replaceHandler),
        num_pages: original_data.num_pages,
        pages: original_data.images.pages.map(ConvertOriginalToImage)
    };


    // download Images
    let ddd = Promise.all(converted.pages.map(async (e, i) => {
        //{ "type": "jpg", "width": 1075, "heigth": 1522, "orientation": "vertical" }

        const base_link = "https://i.nhentai.net";
        const url = `${base_link}/galleries/${converted.repo_id}/${i + 1}.${e.type}`;

        let fff = await fetch(url);
        return await fff.arrayBuffer();
    }));

    let solve = await ddd;


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

app.post("/download", function (req, res) {
    res.send("Downloaded");
})

app.listen(port, function () {
    console.log("App has started.");
});