import express from "express";

const app = express();
const port = 3721;

app.get("/", function (req, res) {
    res.send('Hello World!')
});

app.listen(port, function () {
    console.log("App has started.");
});