const bcrypt = require('bcryptjs');

const saltRounds = 10;
const plainPassword = "userPassword123";

// Asynchronous (Recommended)
// bcrypt.hash(plainPassword, saltRounds).then((hash) => {
//     console.log(hash);
// });

fetch("https://racematevercel.vercel.app/api/getBoatsByProperties",  {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userId: "9d00b754-d05d-479b-b42b-ffe7200c2ce7",
    token: "er8qdttf2xyoxj0kqk7c",
    properties: [{ key: "name", value: "Cake or Death" }]
  })
}).then((res) => {
  res.json().then((r) => {
    console.log(r);
  });
});