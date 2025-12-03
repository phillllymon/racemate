
// DEV ONLY
const endpoint = "https://racematevercel.vercel.app";

// PROD
// const endpoint = "";

fetch(`${endpoint}/api/hello`).then((res) => {
    res.json().then((r) => {
        console.log(r);
    });
});