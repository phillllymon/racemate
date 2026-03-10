const bcrypt = require('bcryptjs');

const saltRounds = 10;
const plainPassword = "userPassword123";

// Asynchronous (Recommended)
// bcrypt.hash(plainPassword, saltRounds).then((hash) => {
//     console.log(hash);
// });

fetch("https://racematevercel.vercel.app/api/auth/signOut",  {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userId: "f51db4b8-816f-4ff8-b42c-1c22214734e4",
    token: "u6eg1x82zthfyi9z1q56"
  })
}).then((res) => {
  res.json().then((r) => {
    console.log(r);
  });
});