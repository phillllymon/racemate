const bcrypt = require('bcryptjs');

const saltRounds = 10;
const plainPassword = "userPassword123";

// Asynchronous (Recommended)
// bcrypt.hash(plainPassword, saltRounds).then((hash) => {
//     console.log(hash);
// });

fetch("https://racematevercel.vercel.app/api/retrieveData",  {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userId: "9d00b754-d05d-479b-b42b-ffe7200c2ce7",
    // userId: "poop",
    token: "5l9kpikjfo7bc5kv417b",
    properties: [{ key: "name", value: "Duck Dodge" }],
    // subProperties: [{ key: "name", value: "Duck Dodge" }]
  })
}).then((res) => {
  res.json().then((r) => {
    console.log(r);
  });
});