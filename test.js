const bcrypt = require('bcryptjs');

const saltRounds = 10;
const plainPassword = "userPassword123";

// Asynchronous (Recommended)
// bcrypt.hash(plainPassword, saltRounds).then((hash) => {
//     console.log(hash);
// });

fetch("https://racematevercel.vercel.app/api/updateBoat",  {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userId: "9d00b754-d05d-479b-b42b-ffe7200c2ce7",
    token: "5l9kpikjfo7bc5kv417b",
    boatId: 1,
    boatName: "Mirage",
    boatInfo: {
      name: "Mirage",
      type: "San Juan 24"
    }
  })
}).then((res) => {
  res.json().then((r) => {
    console.log(r);
  });
});